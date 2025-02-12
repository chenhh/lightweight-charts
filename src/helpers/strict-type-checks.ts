/*
 * Represents a type `T` where every property is optional.
 * 對一個物件型別使用 keyof 操作符，會返回該物件屬性名組成的一個字串或者數字字面量的聯合
 * type PersonDict = {
 *   //"key" 可以是取成任何名稱
 *   [key: string]: string | number;
 * };
 * T為某一物件如ChartOptions或interface
 * [P in keyof T]?為T的屬性之key形成的可選集合, 且限定key的型態是繼承自U
 */
export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends (infer U)[]
		? DeepPartial<U>[]
		: T[P] extends readonly (infer X)[]
			? readonly DeepPartial<X>[]
			: DeepPartial<T[P]>
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function merge(dst: Record<string, any>, ...sources: Record<string, any>[]): Record<string, any> {
	for (const src of sources) {
		// eslint-disable-next-line no-restricted-syntax
		for (const i in src) {
			if (src[i] === undefined) {
				continue;
			}

			if ('object' !== typeof src[i] || dst[i] === undefined) {
				dst[i] = src[i];
			} else {
				merge(dst[i], src[i]);
			}
		}
	}

	return dst;
}

export function isNumber(value: unknown): value is number {
	// 是否為有限的數字
	return (typeof value === 'number') && (isFinite(value));
}

export function isInteger(value: unknown): boolean {
	// 是否為整數
	return (typeof value === 'number') && ((value % 1) === 0);
}

export function isString(value: unknown): value is string {
	// 是否為字串
	return typeof value === 'string';
}

export function isBoolean(value: unknown): value is boolean {
	// 是否為布林值
	return typeof value === 'boolean';
}

export function clone<T>(object: T): T {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const o = object as any;
	if (!o || 'object' !== typeof o) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return o;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let c: any;

	if (Array.isArray(o)) {
		c = [];
	} else {
		c = {};
	}

	let p;
	let v;
	// eslint-disable-next-line no-restricted-syntax
	for (p in o) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,no-prototype-builtins
		if (o.hasOwnProperty(p)) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			v = o[p];
			if (v && 'object' === typeof v) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				c[p] = clone(v);
			} else {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				c[p] = v;
			}
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	return c;
}

export function notNull<T>(t: T | null): t is T {
	return t !== null;
}

export function undefinedIfNull<T>(t: T | null): T | undefined {
	return (t === null) ? undefined : t;
}
