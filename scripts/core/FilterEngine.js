import { parsePrice, parseNumber, parseStars, parseValue } from '../utils/parsers.js';
import { calculateRatingPercentiles } from '../utils/helpers.js';

/**
 * 数据筛选引擎
 * 保持原始筛选逻辑与边界一致
 */
export class FilterEngine{
	/**
	 * 应用筛选条件
	 * @param {any[]} allData 
	 * @param {{search:string, priceMin:number|null, priceMax:number|null, reviewsMin:number|null, scoreMin:number|null, rateMin:number|string, profitStatus:string}} filterState 
	 * @returns {any[]}
	 */
	apply(allData, filterState){
		if(!allData?.length) return [];
		// 容错处理：确保search字段存在且为字符串
		const searchValue = filterState.search || '';
		const q = String(searchValue).toLowerCase().trim();
		const pMin = parseFloat(filterState.priceMin);
		const pMax = parseFloat(filterState.priceMax);
		const revMin = parseFloat(filterState.reviewsMin);
		const sMin = parseFloat(filterState.scoreMin);
		const rateFilter = filterState.rateMin;
		const profitStatusFilter = filterState.profitStatus || 'all';
		
		// 计算星级百分比阈值（如果需要）
		let ratingThreshold = null;
		if(rateFilter && rateFilter !== '0' && typeof rateFilter === 'string'){
			const percentiles = calculateRatingPercentiles(allData, (row) => {
				return parseStars(parseValue(row, 'rating'));
			});
			
			// 根据层级选择设置阈值
			switch(rateFilter){
				case '5star':   // 五星级：前25%（>= 第75百分位数）
					ratingThreshold = percentiles.p75;
					break;
				case '4star+':  // 四星级以上：前50%（>= 第50百分位数）
					ratingThreshold = percentiles.p50;
					break;
				case '3star+':  // 三星级以上：前75%（>= 第25百分位数）
					ratingThreshold = percentiles.p25;
					break;
				case '3star-':  // 三星级以下：后25%（< 第25百分位数）
					ratingThreshold = { type: 'below', value: percentiles.p25 };
					break;
			}
		} else if(rateFilter && typeof rateFilter === 'number' && rateFilter > 0){
			// 兼容旧的数值筛选方式
			ratingThreshold = rateFilter;
		}
		
		const out = allData.filter(row=>{
			// 容错处理：确保row存在
			if(!row || typeof row !== 'object') return false;
			
			// 搜索筛选：只匹配指定列（产品标题、链接打标、PNK码、级类列、品牌列）
			if(q){
				// 定义需要搜索的列
				const searchableKeys = [
					'title',      // 产品标题
					'badge',      // 链接打标
					'pnk',        // PNK码
					'一级类',      // 一级类
					'二级类',      // 二级类
					'三级类',      // 三级类
					'四级类',      // 四级类
					'五级类',      // 五级类
					'品牌'         // 品牌
				];
				
				// 获取这些列的值并拼接
				const searchableValues = searchableKeys
					.map(key => {
						try {
							const value = parseValue(row, key);
							// 容错处理：确保值存在且能安全转换为字符串
							if(value === null || value === undefined) return '';
							// 处理对象、数组等复杂类型
							if(typeof value === 'object') {
								try {
									return JSON.stringify(value).toLowerCase();
								} catch {
									return '';
								}
							}
							return String(value).toLowerCase();
						} catch (error) {
							// 容错处理：如果解析出错，返回空字符串
							return '';
						}
					})
					.filter(val => val && val.length > 0)
					.join(' ');
				
				// 如果所有搜索列的值拼接后不包含关键词，则过滤掉
				if(!searchableValues || !searchableValues.includes(q)) return false;
			}
			// 价格筛选（容错处理）
			if(!Number.isNaN(pMin) || !Number.isNaN(pMax)){
				try {
					const priceVal = parsePrice(parseValue(row, 'price'));
					if(!Number.isNaN(pMin) && (priceVal === -999 || priceVal < pMin)) return false;
					if(!Number.isNaN(pMax) && (priceVal === -999 || priceVal > pMax)) return false;
				} catch (error) {
					// 容错处理：如果价格解析出错，跳过价格筛选
				}
			}
			// 评价数量筛选（容错处理）
			if(!Number.isNaN(revMin)){
				try {
					const reviewsVal = parseNumber(parseValue(row, 'reviews'));
					if(reviewsVal === -999 || reviewsVal < revMin) return false;
				} catch (error) {
					// 容错处理：如果评价数量解析出错，跳过评价数量筛选
				}
			}
			// 评论分数筛选（容错处理）
			if(!Number.isNaN(sMin)){
				try {
					const scoreVal = parseNumber(parseValue(row, 'score'));
					if(scoreVal === -999 || scoreVal < sMin) return false;
				} catch (error) {
					// 容错处理：如果评论分数解析出错，跳过评论分数筛选
				}
			}
			// 星级筛选（容错处理）
			if(ratingThreshold !== null){
				try {
					const rateVal = parseStars(parseValue(row, 'rating'));
					if(typeof ratingThreshold === 'object' && ratingThreshold.type === 'below'){
						// 三星级以下：小于第25百分位数
						if(rateVal >= ratingThreshold.value) return false;
					} else {
						// 其他层级：大于等于阈值
						if(rateVal < ratingThreshold) return false;
					}
				} catch (error) {
					// 容错处理：如果星级解析出错，跳过星级筛选
				}
			}
			// 推送状态筛选
			if(profitStatusFilter !== 'all'){
				const status = row._profitStatus || null;
				switch(profitStatusFilter){
					case 'none':
						// 未推送：状态为 null 或 undefined
						if(status !== null) return false;
						break;
					case 'pushed':
						// 已推送：状态为 'pushed'
						if(status !== 'pushed') return false;
						break;
					case 'deleted':
						// 已删除：状态为 'deleted'
						if(status !== 'deleted') return false;
						break;
				}
			}
			return true;
		});
		return out;
	}
}


