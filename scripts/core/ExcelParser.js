/**
 * Excel 文件解析（基于 Web Worker）
 * 负责初始化 Worker、处理文件读取与进度更新
 */
export class ExcelParser{
	/**
	 * @param {{onProgress:(p:number)=>void,onLoading:(b:boolean,text?:string)=>void,onError:(msg:string)=>void,onSuccess:(rows:any[])=>void}} hooks 
	 */
	constructor(hooks){
		this.hooks = hooks;
		this.worker = null;
	}
	/** 初始化 Worker */
	initWorker(){
		if(this.worker) return;
		// 经典 Worker，内部通过 importScripts 引入 xlsx
		this.worker = new Worker('./scripts/workers/excel.worker.js');
		this.worker.onmessage = (e)=>{
			if(e.data.type === 'success'){
				this.hooks?.onSuccess?.(e.data.data);
				this.hooks?.onLoading?.(false);
			}else{
				this.hooks?.onError?.(e.data.message || '解析失败');
				this.hooks?.onLoading?.(false);
			}
		};
	}
	/**
	 * 处理文件输入
	 * @param {File} file 
	 */
	handleFile(file){
		if(!file) return;
		this.hooks?.onLoading?.(true, '读取中...');
		const reader = new FileReader();
		reader.onprogress = (evt)=>{
			if(evt.lengthComputable){
				const p = Math.min((evt.loaded/evt.total)*100, 80);
				this.hooks?.onProgress?.(p);
			}
		};
		reader.onload = (evt)=>{
			this.hooks?.onProgress?.(85);
			this.worker?.postMessage(evt.target.result);
		};
		reader.readAsArrayBuffer(file);
	}
}


