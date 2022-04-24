import { HoveredObject } from '../model/chart-model';
import { Coordinate } from '../model/coordinate';

export interface IPaneRenderer {
	/**
	 * renders大多數class的介面
	 * draw: 繪製前景
	 * drawBackground: 繪製後景，不一定會有實作
	 * hitTest: 猜測是滑鼠是否進入繪圖內?
	 * @ctx - canvas的繪圖物件
	 * @pixelRatio - canvas的像素縮放比例，一般是長寬等比例縮放
	 * @isHovered - 猜測是滑鼠是否進入繪圖內
	 * @hitTestData? - 不確定
	 *
	 * unknown type:的第一個重要功能：在很多底層的程式碼中，我們不知道傳入的值是什麼型別，
	 * 但是我們本來也就沒有要對它做任何操作、而只是要暫時存放或比較它，此時用 unknown 就能保證它絕對不會不小心被動到。
	 * 功能二：負責把關來自外界的輸入
	 */
	draw(ctx: CanvasRenderingContext2D, pixelRatio: number, isHovered: boolean, hitTestData?: unknown): void;

	drawBackground?(ctx: CanvasRenderingContext2D, pixelRatio: number, isHovered: boolean, hitTestData?: unknown): void;

	hitTest?(x: Coordinate, y: Coordinate): HoveredObject | null;
}
