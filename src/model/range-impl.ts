import { assert } from '../helpers/assertions';

export class RangeImpl<T extends number> {
	/**
	 * T可能為TimePointIndex
	 * left指的是較小的值，right為較大的值
	 */
	private readonly _left: T;
	private readonly _right: T;

	public constructor(left: T, right: T) {
		assert(left <= right, 'right should be >= left');

		this._left = left;
		this._right = right;
	}

	public left(): T {
		/* left getter */
		return this._left;
	}

	public right(): T {
		/* right getter */
		return this._right;
	}

	public count(): number {
		/* 由left至right的點數 */
		return this._right - this._left + 1;
	}

	public contains(index: T): boolean {
		/*判斷index是否在range區間中, 包含邊界 */
		return this._left <= index && index <= this._right;
	}

	public equals(other: RangeImpl<T>): boolean {
		/* 內部left與right相等時傳回true */
		return this._left === other.left() && this._right === other.right();
	}
}

export function areRangesEqual<T extends number>(first: RangeImpl<T> | null, second: RangeImpl<T> | null): boolean {
	// 直接表較兩個RangeImpl是否相同
	if (first === null || second === null) {
		return first === second;
	}

	return first.equals(second);
}
