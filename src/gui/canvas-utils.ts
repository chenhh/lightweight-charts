/**
 * 與canvas繪圖相關的函數
 */

import {Binding as CanvasCoordinateSpaceBinding, bindToDevicePixelRatio} from 'fancy-canvas/coordinate-space';

import {ensureNotNull} from '../helpers/assertions';

export class Size {
	public h: number;
	public w: number;

	public constructor(w: number, h: number) {
		this.w = w;
		this.h = h;
	}

	public equals(size: Size): boolean {
		return (this.w === size.w) && (this.h === size.h);
	}
}

export function getCanvasDevicePixelRatio(canvas: HTMLCanvasElement): number {
	/**
	 * https://developer.mozilla.org/zh-TW/docs/Web/API/HTMLCanvasElement
	 * HTMLCanvasElement 介面提供控制 canvas 元素的屬性和方法. HTMLCanvasElement 介面也繼承了 HTMLElement 介面的屬性和方法.
	 * ownerDocument 唯讀屬性會回傳一個此節點所屬的的頂層 document 物件。
	 * 在瀏覽器中，document.defaultView 屬性會指向一個目前 document 所屬的 window 物件，若無則為 null。
	 * Windo 介面的devicePixelRatio返回當前顯示設備的物理畫素解析度與CSS畫素解析度之比。
	 * 此值也可以解釋為畫素大小的比率：一個CSS畫素的大小與一個物理畫素的大小。
	 * 簡單來說，它告訴瀏覽器應使用多少螢幕實際畫素來繪制單個CSS畫素。
	 */
	return canvas.ownerDocument &&
		canvas.ownerDocument.defaultView &&
		canvas.ownerDocument.defaultView.devicePixelRatio
		|| 1;
}

export function getContext2D(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
	/**
	 * 取得canvas html元素, 型別為內建的CanvasRenderingContext2D
	 */
	const ctx = ensureNotNull(canvas.getContext('2d'));
	// sometimes (very often) ctx getContext returns the same context every time
	// and there might be previous transformation
	// so let's reset it to be sure that everything is ok
	// do no use resetTransform to respect Edge
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	return ctx;
}

export function createPreconfiguredCanvas(doc: Document, size: Size): HTMLCanvasElement {
	const canvas = doc.createElement('canvas');

	const pixelRatio = getCanvasDevicePixelRatio(canvas);
	// we should keep the layout size...
	canvas.style.width = `${size.w}px`;
	canvas.style.height = `${size.h}px`;
	// ...but multiply coordinate space dimensions to device pixel ratio
	canvas.width = size.w * pixelRatio;
	canvas.height = size.h * pixelRatio;
	return canvas;
}

export function createBoundCanvas(parentElement: HTMLElement, size: Size): CanvasCoordinateSpaceBinding {
	const doc = ensureNotNull(parentElement.ownerDocument);
	const canvas = doc.createElement('canvas');
	parentElement.appendChild(canvas);

	const binding = bindToDevicePixelRatio(canvas, { allowDownsampling: false });
	binding.resizeCanvas({
		width: size.w,
		height: size.h,
	});
	return binding;
}

export function drawScaled(ctx: CanvasRenderingContext2D, ratio: number, func: () => void): void {
	/**
	 * 長,寬等比例縮放canvas
	 */
	ctx.save();
	ctx.scale(ratio, ratio);
	func();
	ctx.restore();
}
