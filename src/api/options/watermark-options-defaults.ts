import { defaultFontFamily } from '../../helpers/make-font';

import { WatermarkOptions } from '../../model/watermark';

// 浮水印
export const watermarkOptionsDefaults: WatermarkOptions = {
	color: 'rgba(0, 0, 0, 0)',
	visible: false,	//預設不可見
	fontSize: 48,
	fontFamily: defaultFontFamily,
	fontStyle: '',
	text: '',			 // 浮水印的文字
	horzAlign: 'center', // 預設在圖表中央
	vertAlign: 'center',
};
