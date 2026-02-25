/**
 * 图片预览组件
 */
export class Lightbox{
	/**
	 * @param {{overlay:HTMLElement,img:HTMLImageElement,closeBtn:HTMLElement}} els 
	 */
	constructor(els){
		this.els = els;
	}
	/** 初始化事件 */
	init(){
		this.els.closeBtn.addEventListener('click', ()=> this.hide());
		this.els.overlay.addEventListener('click', (e)=>{ if(e.target === this.els.overlay) this.hide(); });
	}
	/** 显示图片 */
	show(src){
		if(!src) return;
		this.els.img.src = src;
		this.els.overlay.classList.add('active');
	}
	/** 隐藏 */
	hide(){
		this.els.overlay.classList.remove('active');
	}
}


