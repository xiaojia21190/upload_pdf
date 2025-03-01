import dotenv from "dotenv";
// import fetchPdf from "./fetchPdf";
import upload from "./upload";
import log from "./log";
import irys from "./irys";
import fs from "fs";
import { retry } from "./utils/retry";
// import path from "path";
dotenv.config();

const run = async (doi: string, path: string) => {
  // const doi = "10.1103/PhysRevD.76.044016";
  //query author title
  let metadata = await retry(() => irys.queryDoi(doi), {
    maxAttempts: 3,
    initialDelay: 1000,
  });
  if (metadata) {
    const title = metadata.title;
    // 下载文件
    // await fetchPdf(doi);
    // const filePath = path.resolve(INDEX_DATA_TEMP_DIR, `${doi.replace(/\//g, "%2F")}.pdf`);
    // 上传文件
    let pdfIds: Array<string> = [];
    try {
      const pdfIds = await upload.sliceUploadPdf(path, doi, title);
      log.info(`receiptIDs: ${pdfIds}`);
      // 清空 index_data_temp
      fs.unlinkSync(path);
      // 合并文件
      // await upload.mergeSlices(doi, "output.pdf");
      return {
        message: "upload success",
        doi: doi,
        path: path,
        receiptIDs: pdfIds,
      };
    } catch (e) {
      log.error(e);
      return {
        message: "upload failed",
        doi: doi,
        path: path,
        receiptIDs: pdfIds,
      };
    }
  } else {
    log.info(`metadata is null`);
    return {
      message: "metadata is null",
      doi: doi,
      path: path,
      receiptIDs: [],
    };
  }
};


export { run };
