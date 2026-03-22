
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
