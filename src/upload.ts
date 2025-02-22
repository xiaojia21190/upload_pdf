import dotenv from "dotenv";
import fs from "fs";
// import path from "path";
import log from "./log";
import irys from './irys';
import { encodeToBase64 } from './util';

interface UploadProgress {
  doi: string;
  uploadedChunks: number;
  totalChunks: number;
  receiptIDs: string[];
}

dotenv.config(); // 加载 .env 文件中的环境变量

const MAX_SLICE_SIZE = 50 * 1024;

const sliceUploadPdf = async (inputPath: string, doi: string, title: string): Promise<{ receiptIDs: string[] }> => {
  try {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`input path not exists: ${inputPath}`);
    }

    const pdfBytes = fs.readFileSync(inputPath);
    let fileBase64 = encodeToBase64(pdfBytes);
    // 获取文件总大小
    const fileSize = fileBase64.length;
    log.info(`File size: ${fileSize} bytes`);

    // 创建分割后的块数组
    const chunks = [];
    for (let i = 0; i < fileBase64.length; i += MAX_SLICE_SIZE) {
      const chunk = fileBase64.slice(i, i + MAX_SLICE_SIZE);
      chunks.push(chunk);
    }

    log.info(`Total chunks created: ${chunks.length}`);

    // 检查是否存在进度文件
    const progressPath = `d:\\upload_pdf\\temp\\${doi.replace('/', '_')}_progress.json`;
    let progress: UploadProgress = {
      doi,
      uploadedChunks: 0,
      totalChunks: chunks.length,
      receiptIDs: []
    };

    if (fs.existsSync(progressPath)) {
      progress = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
      log.info(`Resuming upload from chunk ${progress.uploadedChunks}/${progress.totalChunks}`);
    }

    const pdfIds = await irys.queryPdf(doi);
    if (pdfIds.length > 0) {
      return {
        receiptIDs: pdfIds
      }
    }

    let receiptIDs: string[] = progress.receiptIDs;
    const tags = [
      { name: "App-Name", value: "scivault" },
      { name: "Content-Type", value: "application/pdf" },
      { name: "Version", value: "1.0.3" },
      { name: "doi", value: doi },
      { name: "title", value: title },
    ];
    for (const [index, slice] of chunks.entries()) {
      log.info(`\nUploading slice...`);
      const receipt = await irys.upload(Buffer.from(slice), tags);
      if (receipt) {
        receiptIDs.push(receipt);
        log.info(`Explorer URL: https://gateway.irys.xyz/${receipt}`);

        // 更新并保存进度
        progress.uploadedChunks = index + 1;
        progress.receiptIDs = receiptIDs;
        fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));


      } else {
        throw new Error("Failed to upload slice");
      }
    }

    //如果上传完后，删除进度文件
    if (progress.uploadedChunks === progress.totalChunks) {
      if (fs.existsSync(progressPath)) {
        fs.unlinkSync(progressPath);
      }
    }
    log.info(`\nPDF uploaded successfully!\nReceipt IDs: ${receiptIDs.join(", ")}`);
    return {
      receiptIDs,
    };

  } catch (error: any) {
    log.error(`slice upload pdf error: ${error.message}`);
    throw error;
  }
};

const mergeSlices = async (doi: string, outputPath: string) => {
  //根据doi查询数据
  const pdfIds = await irys.queryPdf(doi);
  if (pdfIds.length > 0) {
    let pdfTexts = [];
    for (const pdfId of pdfIds) {
      const pdf = await fetch(`https://gateway.irys.xyz/${pdfId}`, {
        method: "GET",
      });
      const pdfBuffer = await pdf.text();
      pdfTexts.push(pdfBuffer);
    }
    // 合并切片
    const mergedBase64 = pdfTexts.join("");
    const mergedBuffer = Buffer.from(mergedBase64, "base64");
    fs.writeFileSync(outputPath, mergedBuffer);
    log.info(`PDF merged successfully to: ${outputPath}`);
  }
};

// 使用示例
// const inputPdfPath = path.join(__dirname, "10.1017%2Fs0263574718001145.pdf"); // 替换为你的输入 PDF 文件路径
// const outputPdfPath = path.join(__dirname, "output.pdf"); // 替换为你的输出 PDF 文件路径

// (async () => {
//   const pdfId = await sliceUploadPdf(inputPdfPath, "10.1017/s0263574718001145");
//   console.log(pdfId);
//   await mergeSlices("10.1017/s0263574718001145", "output.pdf");
// })();


export default {
  sliceUploadPdf,
  mergeSlices,
};
