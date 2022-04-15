import { Callback, ISubscription } from './isubscription';

interface Listener<T1, T2> {
	callback: Callback<T1, T2>;
	linkedObject?: unknown;
	singleshot: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
export class Delegate<T1 = void, T2 = void> implements ISubscription<T1, T2> {
	/**
	 * 事件處理委任類別
	 * callback function的參數最多兩個, T1與T2,
	 * T1可為 MouseEventParams, MouseEventParamsImplSupplier等類別
	 */
	private _listeners: Listener<T1, T2>[] = [];

	public subscribe(callback: Callback<T1, T2>, linkedObject?: unknown, singleshot?: boolean): void {
		/**
		 *  訂閱
		 *  建立新的Listener物件，並放入listeners list中
		 *  callback - 為最多兩個參數的callback function
		 *  linkedObject - callback function連結的物件(事件驅動), 可為this
		 *  singleshot - 指事件被觸發時，對應的callback function是否只會被執行一次，如果為false時，可用fire()轉發
		 */
		const listener: Listener<T1, T2> = {
			callback,
			linkedObject,
			singleshot: singleshot === true,
		};
		this._listeners.push(listener);
	}

	public unsubscribe(callback: Callback<T1, T2>): void {
		/**
		 * 取消訂閱，定listeners list中找出對應的callback function後，將其刪除
		 */
		const index = this._listeners.findIndex((listener: Listener<T1, T2>) => callback === listener.callback);
		if (index > -1) {
			this._listeners.splice(index, 1);
		}
	}

	public unsubscribeAll(linkedObject: unknown): void {
		/**
		 * 刪除listeners list中，指定物件(linkedObject)的所有callback functions
		 */
		this._listeners = this._listeners.filter((listener: Listener<T1, T2>) => listener.linkedObject !== linkedObject);
	}

	public fire(param1: T1, param2: T2): void {
		// 展開符 ... 展開陣列再裝進 [] 空陣列, copy by value
		const listenersSnapshot = [...this._listeners];
		// 去除list中，singleshot為true的callback function
		this._listeners = this._listeners.filter((listener: Listener<T1, T2>) => !listener.singleshot);
		// 執行callback function
		listenersSnapshot.forEach((listener: Listener<T1, T2>) => listener.callback(param1, param2));
	}

	public hasListeners(): boolean {
		/** 判斷物件的listeners list是否為空,
		 *  通常用於檢查特定事件是否有指定的callback functions需要被執行
		 */
		return this._listeners.length > 0;
	}

	public destroy(): void {
		this._listeners = [];
	}
}
