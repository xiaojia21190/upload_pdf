import dotenv from "dotenv";
// import fetchPdf from "./fetchPdf";
// import path from "path";
import upload from "./upload";
import log from "./log";
import irys from './irys';
import fs from 'fs';
dotenv.config();

const run = async (doi: string, path: string) => {
  // const doi = "10.1103/PhysRevD.76.044016";
  //query author title
  let metadata = await irys.queryDoi(doi);
  if (metadata) {
    const title = metadata.title;
    // 下载文件
    // await fetchPdf(doi);
    // const filePath = path.resolve(INDEX_DATA_TEMP_DIR, `${doi.replace(/\//g, "%2F")}.pdf`);
    // 上传文件
    const { receiptIDs } = await upload.sliceUploadPdf(path, doi, title);
    log.info(`receiptIDs: ${receiptIDs}`);
    // 清空 index_data_temp
    fs.unlinkSync(path);
    // 合并文件
    // await upload.mergeSlices(doi, "output.pdf");
    return {
      message: 'upload success',
      doi: doi,
      path: path,
      receiptIDs: receiptIDs
    }
  } else {
    log.info(`metadata is null`);
    return {
      message: 'metadata is null',
      doi: doi,
      path: path,
      receiptIDs: []
    }
  }

};

export { run };

// run();
