//"jsdom": "^11.10.0",
//"jquery": "^3.3.1",
//"async": "^2.6.2",

const jsdom = require("jsdom/lib/old-api");
const jquery = require('jquery');
const request = require('request');
const async = require('async');
const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const json = require('./scrawler.json');
const end = 76;


jsdom.env("", function(err, window) {
	let pages = Array.apply(null, {length: end})
									.map(Number.call, Number)
									.reverse();



	//pages = [2,3,4];		
        pages = pages.slice(0, 11);
	async.eachSeries(pages, (page, next) => {
		console.log(page);
		request(`https://www.voase.cn/index${page ? '-' + (page + 1) : ''}.htm`, (err, res, body) => {
			//console.log(err, body)
			const $ = jquery(window);
			$("body").html(body);

			const rows = [];
			$('#listall li').each(function() {
				const link = $(this).find('a').eq(1).attr('href');
				const data = {link: link};
				const time = link.slice(0, 19);
				const name = link.replace(/\.html$/, '').slice(19).replace(/-/g,'%20');
				data.mp3 = `https://www.voase.cn${time}${name}.mp3`
				data.lrc = `https://www.voase.cn${time}${name}.lrc`;
				data.txt = `https://www.voase.cn${time}${name}.txt`;
				data.month = time.slice(1,8).replace('/', '')
				data.folder = link.slice(9, 19) + link.replace(/\.html$/, '').slice(19).replace(/-/g,' ');
				rows.push(data);
			});



			async.eachSeries(rows, (row, next1) => {
				if (json[row.link]) {
					return next1();
				}

				const dir = path.join(__dirname, `../media/${row.month}/${row.folder}`)

				fse.ensureDirSync(dir);

				let stream = fs.createWriteStream(`${dir}/${row.folder}.txt`);
        request(row.txt).pipe(stream).on("close", function (err) {
        	if (err) {
        		process.exit()
        	}

        	let stream = fs.createWriteStream(`${dir}/${row.folder}.lrc`);
          request(row.lrc).pipe(stream).on("close", function (err) {
	        	if (err) {
	        		process.exit()
	        	}
	            
	          let stream = fs.createWriteStream(`${dir}/${row.folder}.mp3`);
	          request(row.mp3).pipe(stream).on("close", function (err) {
		        	if (err) {
		        		process.exit()
		        	}
		          json[row.link] = 1;
		          fs.writeFileSync('./bin/scrawler.json', JSON.stringify(json, null, 2), 'utf8');
		          setTimeout(() => {
		          	next1();
		          }, 2000);
		        });
	        });
        });
			}, () => {
				next();
			});
			
		});
	}, (err) => {
		console.log('all done', err);
	});


});

