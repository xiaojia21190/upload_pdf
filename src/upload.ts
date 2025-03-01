import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import log from "./log";
import irys from "./irys";
import { encodeToBase64 } from "./util";
import { retry } from "./utils/retry";

interface UploadProgress {
  doi: string;
  uploadedChunks: number;
  totalChunks: number;
  receiptIDs: string[];
}

dotenv.config(); // 加载 .env 文件中的环境变量

const MAX_SLICE_SIZE = 50 * 1024;

const INDEX_DATA_TEMP_DIR = process.env.INDEX_DATA_TEMP_DIR || "index_data_temp";

const sliceUploadPdf = async (
  inputPath: string,
  doi: string,
  title: string,
) => {
  try {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`input path not exists: ${inputPath}`);
    }

    const pdfBytes = fs.readFileSync(inputPath);
    let fileBase64 = encodeToBase64(pdfBytes);
    const fileSize = fileBase64.length;
    log.info(`File size: ${fileSize} bytes`);

    const chunks = [];
    for (let i = 0; i < fileBase64.length; i += MAX_SLICE_SIZE) {
      const chunk = fileBase64.slice(i, i + MAX_SLICE_SIZE);
      chunks.push(chunk);
    }

    log.info(`Total chunks created: ${chunks.length}`);

    // 检查是否存在进度文件
    const progressPath = path.resolve(
      INDEX_DATA_TEMP_DIR,
      `${doi.replace(/\//g, "%2F")}_progress.json`,
    );
    let progress: UploadProgress = {
      doi,
      uploadedChunks: 0,
      totalChunks: chunks.length,
      receiptIDs: [],
    };

    if (fs.existsSync(progressPath)) {
      progress = JSON.parse(fs.readFileSync(progressPath, "utf-8"));
      log.info(
        `Resuming upload from chunk ${progress.uploadedChunks}/${progress.totalChunks}`,
      );
    }

    // 移除这里的重试，因为 irys.queryPdf 已经有重试机制
    const pdfIds = await irys.queryPdf(doi);
    if (pdfIds.length > 0) {
      return pdfIds;
    }

    let receiptIDs: string[] = progress.receiptIDs;
    const tags = [
      { name: "App-Name", value: "scivault" },
      { name: "Content-Type", value: "application/pdf" },
      { name: "Version", value: "1.0.3" },
      { name: "doi", value: doi },
      { name: "title", value: title },
    ];

    // 从上次中断的地方继续上传
    for (let i = progress.uploadedChunks; i < chunks.length; i++) {
      const slice = chunks[i];
      log.info(`\nUploading slice ${i + 1}/${chunks.length}...`);

      try {
        // irys.upload 已经包含重试机制，这里不需要额外的重试
        const receipt = await irys.upload(Buffer.from(slice), tags);
        receiptIDs.push(receipt);
        log.info(`Explorer URL: https://gateway.irys.xyz/${receipt}`);

        // 更新进度
        progress = {
          doi,
          uploadedChunks: i + 1,
          totalChunks: chunks.length,
          receiptIDs,
        };
        fs.writeFileSync(progressPath, JSON.stringify(progress));
      } catch (error) {
        log.error(`Failed to upload slice ${i + 1}: ${error}`);
        throw error;
      }
    }

    // 上传完成后删除进度文件
    if (fs.existsSync(progressPath)) {
      fs.unlinkSync(progressPath);
    }

    log.info(
      `\nPDF uploaded successfully!\nReceipt IDs: ${receiptIDs.join(", ")}`,
    );
    return receiptIDs;

  } catch (error: any) {
    log.error(`slice upload pdf error: ${error.message}`);
    throw error;
  }
};

const mergeSlices = async (doi: string, outputPath: string) => {
  // 移除这里的重试，因为 irys.queryPdf 已经有重试机制
  const pdfIds = await irys.queryPdf(doi);
  if (pdfIds.length > 0) {
    let pdfTexts = [];
    for (const pdfId of pdfIds) {
      // 添加对 gateway 请求的重试
      const pdfBuffer = await retry(async () => {
        const pdf = await fetch(`https://gateway.irys.xyz/${pdfId}`, {
          method: "GET",
        });
        if (!pdf.ok) {
          throw new Error(`Failed to fetch PDF: ${pdf.statusText}`);
        }
        return pdf.text();
      }, {
        maxAttempts: 3,
        initialDelay: 1000,
      });
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
