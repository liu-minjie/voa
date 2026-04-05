
//https://dict.youdao.com/wordbook/wordlist?wordbook_id=B9835973-8BB8-4DDF-96DF-366C32023D09#/


(async () => {
    const limit = 48; // 匹配你抓取的原生请求 limit
    let offset = 0;
    let allWords = [];
    let hasMore = true;

    // 自动获取分组 ID
    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get('wordbook_id') || ""; 

    console.log(`🚀 开始提取单词... (分组ID: ${bookId || '默认'})`);

    while (hasMore) {
        // 构建 API URL
        const apiUrl = `https://dict.youdao.com/wordbook/webapi/words?limit=${limit}&offset=${offset}&bookId=B9835973-8BB8-4DDF-96DF-366C32023D09`;
        
        try {
            const response = await fetch(apiUrl, {
                "credentials": "include", // 【关键修复】强制携带 Cookie
                "method": "GET",
                "mode": "cors"
            });

            if (response.status === 401) {
                console.error("❌ 依然返回 401：请确保你是在 dict.youdao.com 域名下的页面执行此脚本。");
                break;
            }

            const data = await response.json();

            if (data.code === 0 && data.data && data.data.itemList) {
                const list = data.data.itemList;
                list.forEach(item => {
                    allWords.push({
                        word: item.word,
                        trans: item.trans,
                        phone: item.phonetic || null
                    });
                });

                console.log(`✅ 已获取 ${allWords.length} 条数据...`);

                if (list.length < limit) {
                    hasMore = false;
                } else {
                    offset += limit;
                }
            } else {
                console.warn("停止抓取：接口未返回更多数据或结构变动", data);
                hasMore = false;
            }
        } catch (err) {
            console.error("❌ 网络请求失败:", err);
            hasMore = false;
        }

        if (hasMore) {
            console.log("等待 2 秒进行下一次请求...");
            await new Promise(r => setTimeout(r, 2000)); // 【要求修复】固定间隔 2 秒
        }
    }

    if (allWords.length > 0) {
        console.log("🎉 全部提取完成！准备下载...");
        window.allWords = allWords
    } else {
        console.error("未获取到任何单词，请检查登录状态。");
    }
})();


/*
{

    "bookId": "0",
    "bookName": "我的单词本"
},

{
    "bookId": "b6eee1ee948f4e5d879e969e59ff5218",
    "bookName": "key"
},

{
    "bookId": "B9835973-8BB8-4DDF-96DF-366C32023D09",
    "bookName": "句子"
},

{
    "bookId": "9b5a48b486d9461fb573fb6f391f0dfb",
    "bookName": "zh"
},

{
    "bookId": "1edb519c85e04c81914587e395d44ad3",
    "bookName": "new"
},
{
    "bookId": "344976279dd84389955cb09e101db079",
    "bookName": "听力"
}

*/






/*
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// 路径已修改为当前目录
const dbPath = './wordbook.db';
const outputPath = './youdao_final_fixed.json';

const db = new sqlite3.Database(dbPath);

async function exportAll() {
    const tables = ['NEW_WORDBOOK_TABLE', 'REMTABLE'];
    let finalItems = [];
    let seen = new Set(); // 防止重复提取

    for (const table of tables) {
        await new Promise((resolve) => {
            // 使用 SELECT * 避免字段名不一致报错
            db.all(`SELECT * FROM ${table} WHERE state = 0`, [], (err, rows) => {
                if (err || !rows) return resolve();

                rows.forEach(row => {
                    const timestamp = row.create_time || row.clientModifiedTime || 0;
                    const timeStr = new Date(timestamp).toLocaleString('zh-CN');
                    const rawContent = (row.name || row.word || "").trim();

                    try {
                        const data = JSON.parse(row.trans);
                        
                        // --- 逻辑 1: 深度挖掘“藏在单词里的句子”（例句收藏） ---
                        // 这种情况原文(name)可能是个单词，但 JSON 里存了你想收藏的句子
                        if (data.trs && data.trs[0] && data.trs[0].sentence) {
                            data.trs[0].sentence.forEach(s => {
                                const en = (s.en || s.enShow || "").replace(/<[^>]+>/g, '').trim();
                                if (en && !seen.has(en)) {
                                    seen.add(en);
                                    finalItems.push({
                                        "原文": en,
                                        "翻译": s.zh || "",
                                        "时间": timeStr,
                                        "ts": timestamp,
                                        "来源": "单词关联例句"
                                    });
                                }
                            });
                        }

                        // --- 逻辑 2: 提取本身就是句子的条目 ---
                        // 规则：包含空格且长度大于 10 (有效避开大部分纯单词)
                        const cleanContent = rawContent.replace(/<[^>]+>/g, '');
                        if (cleanContent.includes(' ') && cleanContent.length > 10 && !seen.has(cleanContent)) {
                            let tran = "";
                            if (data.trs && data.trs[0]) {
                                tran = data.trs[0].tran || data.trs[0].zh || "";
                            }
                            if (!tran && data.translate) tran = data.translate;

                            seen.add(cleanContent);
                            finalItems.push({
                                "原文": cleanContent,
                                "翻译": tran,
                                "时间": timeStr,
                                "ts": timestamp,
                                "来源": "独立收藏句子"
                            });
                        }
                    } catch (e) {
                        // JSON 解析失败
                    }
                });
                resolve();
            });
        });
    }

    // 按时间由旧到新排序
    finalItems.sort((a, b) => a.ts - b.ts);

    fs.writeFileSync(outputPath, JSON.stringify(finalItems, null, 2), 'utf8');
    console.log(`--- 导出成功 ---`);
    console.log(`总计提取到句子: ${finalItems.length} 条`);
    console.log(`文件位置: ${outputPath}`);
}

exportAll().then(() => db.close());

*/













/*
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath =  './wordbook.db';
const outputPath = './youdao_all_sentences.json';

const db = new sqlite3.Database(dbPath);

// 修改点：增加了 ORDER BY create_time ASC
const sql = `SELECT name, trans, create_time FROM NEW_WORDBOOK_TABLE WHERE state = 0 ORDER BY create_time DESC`;

db.all(sql, [], (err, rows) => {
    if (err) {
        console.error("查询失败:", err.message);
        return;
    }

    let sentenceList = [];

    rows.forEach(row => {
        try {
            const data = JSON.parse(row.trans);
            
            // 提取逻辑 A：解析 trs 里的例句结构
            if (data.trs && data.trs[0] && data.trs[0].sentence) {
                data.trs[0].sentence.forEach(s => {
                    sentenceList.push({
                        "原文": (s.en || s.enShow || "").replace(/<[^>]+>/g, ''),
                        "翻译": s.zh || "",
                        "类型": "收藏例句",
                        "添加时间": new Date(row.create_time).toLocaleString('zh-CN'),
                        "timestamp": row.create_time
                    });
                });
            } 
            // 提取逻辑 B：如果本身原文就是长句子
            else if (row.name && row.name.includes(' ') && row.name.length > 10) {
                let tran = "";
                if (data.trs && data.trs[0]) tran = data.trs[0].tran || "";
                
                sentenceList.push({
                    "原文": row.name,
                    "翻译": tran,
                    "类型": "独立长句",
                    "添加时间": new Date(row.create_time).toLocaleString('zh-CN'),
                    "timestamp": row.create_time
                });
            }
        } catch (e) {
            // 忽略 JSON 解析错误的条目
        }
    });

    // 最终在内存中再强制排序一次（确保万无一失）
    sentenceList.sort((a, b) => b.timestamp - a.timestamp);

    fs.writeFileSync(outputPath, JSON.stringify(sentenceList, null, 2), 'utf8');
    
    console.log(`--- 导出报告 ---`);
    console.log(`排序完成！共提取到句子: ${sentenceList.length} 条`);
    console.log(`文件已存至: ${outputPath}`);
});
 
db.close();


find ~/Library/Containers/com.youdao.YoudaoDict/Data/Library/com.youdao.YoudaoDict -name "*.db"
sqlite3 ~/Desktop/wordbook.db ".tables"
*/
