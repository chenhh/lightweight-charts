/**
 * Binary function that accepts two arguments (the first of the type of array elements, and the second is always val), and returns a value convertible to bool.
 * The value returned indicates whether the first argument is considered to go before the second.
 * The function shall not modify any of its arguments.
 * 二元函數，接受兩個參數（第一個是陣列元素的類型，第二個總是純量值），並返回一個可轉換為bool的值。
 * 返回的值表示第一個參數是否被認為是在第二個參數之前。
 * 該函數不得修改其任何參數。
 */

export type LowerBoundComparatorType<TArrayElementType, TValueType> = (a: TArrayElementType, b: TValueType) => boolean;

export function lowerbound<TArrayElementType, TValueType>(
	arr: readonly TArrayElementType[],
	value: TValueType,
	compare: LowerBoundComparatorType<TArrayElementType, TValueType>,
	start: number = 0,
	to: number = arr.length): number {
	let count: number = to - start;
	while (0 < count) {
		const count2: number = (count >> 1);
		const mid: number = start + count2;
		if (compare(arr[mid], value)) {
			start = mid + 1;
			count -= count2 + 1;
		} else {
			count = count2;
		}
	}

	return start;
}

/**
 * Binary function that accepts two arguments (the first is always val, and the second of the type of array elements), and returns a value convertible to bool.
 * The value returned indicates whether the first argument is considered to go before the second.
 * The function shall not modify any of its arguments.
 */

export type UpperBoundComparatorType<TValueType, TArrayElementType> = (a: TValueType, b: TArrayElementType) => boolean;

export function upperbound<TArrayElementType, TValueType>(
	arr: readonly TArrayElementType[],
	value: TValueType,
	compare: UpperBoundComparatorType<TValueType, TArrayElementType>,
	start: number = 0,
	to: number = arr.length): number {
	let count: number = to - start;
	// 看起來像binary search, 但是array並沒有排序?
	while (0 < count) {
		const count2: number = (count >> 1);
		const mid: number = start + count2;
		if (!(compare(value, arr[mid]))) {
			start = mid + 1;
			count -= count2 + 1;
		} else {
			count = count2;
		}
	}

	return start;
}
