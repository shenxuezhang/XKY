/* eslint-disable no-undef */
// 在 Worker 中引入 xlsx
importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');

self.onmessage = function(e){
	try{
		const data = new Uint8Array(e.data);
		const wb = XLSX.read(data, { type:'array' });
		const ws = wb.Sheets[wb.SheetNames[0]];
		const json = XLSX.utils.sheet_to_json(ws);
		const processed = json.map((row, idx)=>({ ...row, _uid: idx }));
		self.postMessage({ type: processed.length ? 'success' : 'error', data: processed, message:'空数据' });
	}catch(err){
		self.postMessage({ type:'error', message: err.message });
	}
};


