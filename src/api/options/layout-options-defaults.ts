import { defaultFontFamily } from '../../helpers/make-font';

import { ColorType, LayoutOptions } from '../../model/layout-options';

// 圖表的背景色，文字預設值
export const layoutOptionsDefaults: LayoutOptions = {
	background: {
		type: ColorType.Solid,
		color: '#FFFFFF',
	},
	textColor: '#191919',
	fontSize: 11,
	fontFamily: defaultFontFamily,
};
