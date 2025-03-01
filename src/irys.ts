import dotenv from "dotenv";
import { Uploader } from "@irys/upload";
import { Solana } from "@irys/upload-solana";
import log from "./log";
import { retry } from "./utils/retry";

dotenv.config(); // 加载 .env 文件中的环境变量

const getIrysUploader = async () => {
  return retry(async () => {
    try {
      const irysUploader = await Uploader(Solana).withWallet(process.env.PRIVATE_KEY);
      log.info("Irys uploader initialized.");
      return irysUploader;
    } catch (error) {
      log.error(`Failed to initialize Irys uploader: ${error}`);
      throw error; // 抛出错误以触发重试
    }
  }, {
    maxAttempts: 3,
    initialDelay: 2000,
  });
};

const executeGraphQLQuery = async (query: string) => {
  return retry(async () => {
    const response = await fetch("https://uploader.irys.xyz/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.statusText}`);
    }

    return response.json();
  }, {
    maxAttempts: 3,
    initialDelay: 1000,
  });
};

const queryDoi = async (doi: string) => {
  const query = `
    query {
        transactions(
            tags: [
                { name: "App-Name", values: ["scivault"] },
                { name: "Content-Type", values: ["application/json"] },
                { name: "Version", values: ["1.0.3"] },
                { name: "doi", values: ["${doi}"] },
            ]
        ) {
            edges {
                node {
                    id
                }
            }
        }
    }
  `;

  try {
    const result = await executeGraphQLQuery(query);
    log.info(`metadata index: ${JSON.stringify(result)}`);

    const id = result.data?.transactions?.edges?.[0]?.node?.id;
    if (!id) {
      return null;
    }

    log.info(`metadata index ID: ${id}`);

    const response = await retry(async () => {
      const res = await fetch(`https://gateway.irys.xyz/${id}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch metadata: ${res.statusText}`);
      }
      return res.json();
    }, {
      maxAttempts: 3,
      initialDelay: 1000,
    });

    log.info(`metadata index: ${JSON.stringify(response)}`);
    return response;
  } catch (error) {
    log.error(`Error querying DOI: ${error}`);
    throw error;
  }
};

const queryPdf = async (doi: string) => {
  const query = `
    query {
        transactions(
            tags: [
                { name: "App-Name", values: ["scivault"] },
                { name: "Content-Type", values: ["application/pdf"] },
                { name: "Version", values: ["1.0.3"] },
                { name: "doi", values: ["${doi}"] },
            ]
        ) {
            edges {
                node {
                    id
                }
            }
        }
    }
  `;

  try {
    const result = await executeGraphQLQuery(query);

    const edges = result.data?.transactions?.edges;
    if (!edges || edges.length === 0) {
      return [];
    }

    const pdfIds = edges.map((edge: any) => edge.node.id);
    log.info(`PDF IDs: ${pdfIds.join(", ")}`);
    return pdfIds;
  } catch (error) {
    log.error(`Error querying PDF: ${error}`);
    throw error;
  }
};

const upload = async (slice: any, tags: any) => {
  try {
    const irys = await getIrysUploader();
    if (!irys) {
      throw new Error("Failed to initialize Irys uploader");
    }

    const receipt = await retry(async () => {
      const uploadReceipt = await irys.upload(slice, { tags });
      if (!uploadReceipt || !uploadReceipt.id) {
        throw new Error("Upload failed - no receipt ID received");
      }
      return uploadReceipt;
    }, {
      maxAttempts: 3,
      initialDelay: 2000,
      factor: 1.5,
    });

    log.info(`receipt: ${JSON.stringify(receipt)}`);
    return receipt.id;
  } catch (error) {
    log.error(`Upload error: ${error}`);
    throw error;
  }
};

export default {
  queryDoi,
  upload,
  queryPdf
};

