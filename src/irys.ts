import dotenv from "dotenv";
import { Uploader } from "@irys/upload";
import { Solana } from "@irys/upload-solana";
import log from "./log";
dotenv.config(); // 加载 .env 文件中的环境变量



const getIrysUploader = async () => {
  try {
    const irysUploader = await Uploader(Solana).withWallet(process.env.PRIVATE_KEY);
    log.info("Irys uploader initialized.");
    return irysUploader;
  } catch (error) {
    log.error(`Failed to initialize Irys uploader: ${error}`);
  }
};

const queryDoi = async (doi: string) => {
  const query = `
    query {
        transactions(
            tags: [
                { name: "App-Name", values: ["scivault"] },
                { name: "Content-Type", values: ["application/json"] },
                { name: "Version", values: ["0.1.0"] },
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


  const response = await fetch("https://uploader.irys.xyz/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  const result = await response.json();
  console.log(result);
  const id = result.data?.transactions?.edges?.[0]?.node?.id;
  if (id) {
    log.info(`metadata index ID: ${id}`);
    let response = await fetch(`https://gateway.irys.xyz/${id}`);
    let result = await response.json();
    log.info(`metadata index: ${JSON.stringify(result)}`);
    return result;
  }

}

const queryPdf = async (doi: string) => {
  const query = `
  query {
      transactions(
          tags: [
              { name: "App-Name", values: ["scivault"] },
              { name: "Content-Type", values: ["application/pdf"] },
              { name: "Version", values: ["0.1.0"] },
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

  // 使用正确的 GraphQL endpoint
  const response = await fetch("https://uploader.irys.xyz/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  const result = await response.json();
  const id = result.data?.transactions?.edges?.[0]?.node?.id;
  if (id) {
    log.info(`PDF index ID: ${id}`);
    // 获取所有pdf的id
    let pdfIds: string[] = [];
    result.data.transactions.edges.forEach((edge: any) => {
      pdfIds.push(edge.node.id);
    });
    log.info(`PDF IDs: ${pdfIds.join(", ")}`);
    return pdfIds;
  } else {
    return []
  }
}

const upload = async (slice: any, tags: any) => {
  const irys = await getIrysUploader();
  if (irys) {
    const receipt = await irys.upload(slice, tags);
    log.info(`receipt: ${JSON.stringify(receipt)}`);
    return receipt.id;
  } else {
    log.error(`Failed to initialize Irys uploader: ${irys}`);
    return "";
  }
}

export default {
  queryDoi,
  upload,
  queryPdf
}

