/**
 * 侧边栏开关控制（仅负责展示层，不涉及业务逻辑）
 */
export class Sidebar{
	/**
	 * @param {{toggleBtn:HTMLElement,closeBtn:HTMLElement,sidebar:HTMLElement,overlay:HTMLElement}} els
	 */
	constructor(els){
		this.els = els;
	}
	init(){
		const { toggleBtn, closeBtn, sidebar, overlay } = this.els;
		if(!toggleBtn || !closeBtn || !sidebar || !overlay) return;

		const open = ()=>{
			sidebar.classList.add('open');
			overlay.classList.add('active');
		};
		const close = ()=>{
			sidebar.classList.remove('open');
			overlay.classList.remove('active');
		};
		toggleBtn.addEventListener('click', open);
		closeBtn.addEventListener('click', close);
		overlay.addEventListener('click', close);
		document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') close(); });
	}
}


