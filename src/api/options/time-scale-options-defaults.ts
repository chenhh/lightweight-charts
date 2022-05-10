import { TimeScaleOptions } from '../../model/time-scale';

export const timeScaleOptionsDefaults: TimeScaleOptions = {
	rightOffset: 0,
	barSpacing: 6,	// 圖形中兩個bar之間的距離(px)，以兩個bar間的中點計算
	minBarSpacing: 0.5,	// 圖形中兩個bar之間的最小距離(px)
	fixLeftEdge: false,	 // 圖形中，否是固定左側不隨縮放移動
	fixRightEdge: false, // 圖形中，否是固定右側不隨縮放移動
	lockVisibleTimeRangeOnResize: false,
	rightBarStaysOnScroll: false,
	borderVisible: true,
	borderColor: '#2B2B43',
	visible: true,
	timeVisible: false,	//預設只看到的日期, true可看到日期與時間
	secondsVisible: true,
	shiftVisibleRangeOnNewBar: true,
};
