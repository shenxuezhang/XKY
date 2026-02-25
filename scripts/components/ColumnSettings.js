import { CONFIG_KEY } from '../config/columns.js';

/**
 * 列设置模态框
 */
export class ColumnSettings{
	/**
	 * @param {{openBtn:HTMLElement,modal:HTMLElement,list:HTMLElement,closeBtn:HTMLElement,cancelBtn:HTMLElement,saveBtn:HTMLElement}} els 
	 * @param {()=>Array} getColConfig 
	 * @param {(cols:Array)=>void} setColConfig 
	 * @param {()=>void} onAfterSave 
	 */
	constructor(els, getColConfig, setColConfig, onAfterSave){
		this.els = els;
		this.getColConfig = getColConfig;
		this.setColConfig = setColConfig;
		this.onAfterSave = onAfterSave;
	}
	init(){
		this.els.openBtn.addEventListener('click', ()=> this.open());
		this.els.closeBtn.addEventListener('click', ()=> this.close());
		this.els.cancelBtn.addEventListener('click', ()=> this.close());
		this.els.modal.addEventListener('click', (e)=>{ if(e.target === this.els.modal) this.close(); });
		this.els.saveBtn.addEventListener('click', ()=> this.save());
	}
	open(){
		this.els.list.innerHTML = '';
		const cols = this.getColConfig();
		cols.forEach((col, idx)=>{
			if(col.key === 'select') return;
			const div = document.createElement('div');
			div.className = 'flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100';
			div.innerHTML = `
				<span class="text-sm text-gray-700">${col.label}</span>
				<label class="inline-flex items-center cursor-pointer">
					<input type="checkbox" class="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 transition focus:ring-blue-500" data-idx="${idx}" ${col.fixed ? 'checked' : ''}>
					<span class="ml-2 text-xs text-gray-500">冻结</span>
				</label>
			`;
			this.els.list.appendChild(div);
		});
		this.els.modal.classList.add('active');
	}
	close(){ this.els.modal.classList.remove('active'); }
	save(){
		const cols = this.getColConfig();
		this.els.list.querySelectorAll('input[type="checkbox"]').forEach(cb=>{
			const idx = parseInt(cb.getAttribute('data-idx'));
			cols[idx].fixed = cb.checked;
		});
		this.setColConfig(cols);
		localStorage.setItem(CONFIG_KEY, JSON.stringify(cols));
		this.onAfterSave?.();
		this.close();
	}
}


