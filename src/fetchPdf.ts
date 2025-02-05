import fs from "fs";
import path from "path";
import axios from "axios";
import * as cheerio from 'cheerio';
import dotenv from "dotenv";
import log from "./log";

dotenv.config();


// 常量
const INDEX_DATA_TEMP_DIR = process.env.INDEX_DATA_TEMP_DIR || "index_data_temp";
const SCI_HUB_BASE_URLS = [
  "https://sci-hub.st/",
  "https://sci-hub.se/",
  "https://sci-hub.ru/",
  "https://www.tesble.com/",
];


// 工具函数：下载文件
const downloadPDF = async (url: string, filePath: string) => {
  log.info(`begin download: ${url} -> ${filePath}`);
  try {
    const writer = fs.createWriteStream(filePath);
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
    });

    response.data.pipe(writer);

    // 处理完成事件
    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        log.info(`success download: ${url}`);
        resolve(true);
      });
      writer.on("error", (err: any) => {
        log.error(`download failed: ${err}`);
        reject(false);
      });
    });
  } catch (error: any) {
    log.error(`download error: ${url}. error: ${error.message}`);
    return false;
  }
};


// Sci-Hub 下载器
const scihubScraper = async (scihubURL: string, doi: string, filePath: string) => {
  log.info(`begin download scihub: ${scihubURL}${doi}`);
  try {
    const response = await axios.get(`${scihubURL}${doi}`);
    console.log(response);
    const $ = cheerio.load(response.data);

    const embedTag = $("embed[type='application/pdf']");
    const pdfURL = embedTag.attr("src");

    if (pdfURL) {
      const formattedURL = pdfURL.startsWith("//")
        ? `https:${pdfURL}`
        : scihubURL + pdfURL;

      log.info(`PDF URL: ${formattedURL}`);
      return await downloadPDF(formattedURL, filePath);
    } else {
      log.warn("not found embed tag");
      return null;
    }
  } catch (error: any) {
    log.error(`request web error: ${error.message}`);
    return null;
  }
};

// 动态获取 Sci-Hub URL
const getScihubURL = async () => {
  const url = "https://www.sci-hub.pub";
  try {
    const response = await axios.get(url);
    const matches = Array.from(response.data.matchAll(/<a[^>]*href="([^"]+)"[^>]*>/gi))
      .map((match: any) => match[1])
      .filter((match: any) => match.includes("sci-hub"));

    matches.push("https://www.tesble.com/");
    return matches;
  } catch (error: any) {
    log.error(`get scihub url error: ${error.message}`);
    return [];
  }
};

// 主运行函数
const fetchPdf = async (doi: string) => {
  const fetchedScihubURLs = await getScihubURL();
  const scihubURLs = fetchedScihubURLs.length ? fetchedScihubURLs : SCI_HUB_BASE_URLS;

  log.info(`used scihub url: ${scihubURLs}`);

  // 确保存储目录存在
  if (!fs.existsSync(INDEX_DATA_TEMP_DIR)) {
    fs.mkdirSync(INDEX_DATA_TEMP_DIR, { recursive: true });
  }

  // 替换 DOI 中的斜杠以适配文件名
  const doiPath = doi.replace(/\//g, "%2F");
  const filePath = path.resolve(INDEX_DATA_TEMP_DIR, `${doiPath}.pdf`);

  // 如果文件已存在，则直接返回
  if (fs.existsSync(filePath)) {
    log.info("file exists");
    return;
  }

  for (const scihubURL of scihubURLs) {
    const sciHubSuccess = await scihubScraper(scihubURL, doi, filePath);
    if (sciHubSuccess) {
      break;
    }
  }

  if (fs.existsSync(filePath)) {
    log.info("download success");
  } else {
    log.error("download failed");
  }
};

export default fetchPdf;
