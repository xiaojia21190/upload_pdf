import dotenv from "dotenv";
import fetchPdf from "./fetchPdf";
import path from "path";
import upload from "./upload";
import log from "./log";
import irys from './irys';
import fs from 'fs';
dotenv.config();

const INDEX_DATA_TEMP_DIR = process.env.INDEX_DATA_TEMP_DIR || "index_data_temp";

const run = async () => {
  const doi = "10.1103/PhysRevD.76.044016";
  //query author title
  let metadata = await irys.queryDoi(doi);
  if (metadata) {
    const title = metadata.title;
    // 下载文件
    await fetchPdf(doi);
    const filePath = path.resolve(INDEX_DATA_TEMP_DIR, `${doi.replace(/\//g, "%2F")}.pdf`);
    // 上传文件
    const { receiptIDs } = await upload.sliceUploadPdf(filePath, doi, title,);
    log.info(`receiptIDs: ${receiptIDs}`);
    // 清空 index_data_temp
    fs.unlinkSync(filePath);
    // 合并文件
    // await upload.mergeSlices(doi, "output.pdf");
  } else {
    log.info(`metadata is null`);
  }

};

run();
