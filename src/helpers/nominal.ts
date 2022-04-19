/**
 * This is the generic type useful for declaring a nominal type,
 * which does not structurally matches with the base type and
 * the other types declared over the same base type
 * 這是一個通用類型，用於聲明一個名義類型，它在結構上與基礎類型和在同一
 * 基礎類型上聲明的其他類型不匹配。
 * 可以將基礎名稱取別名如Nomial<number, "T1">, Nomial<number, "T2">
 * 上面兩個類別雖然基礎類別都是number，但是ts將其視為類別T1, T2，因此
 * let i: T1 = 40 as T1;
 * let j: T2 = 40 as T2;
 * i不等於j, 因為是不同類別
 *
 * @example
 * ```ts
 * type Index = Nominal<number, 'Index'>;
 * // let i: Index = 42; // this fails to compile
 * let i: Index = 42 as Index; // OK
 * ```
 * @example
 * ```ts
 * type TagName = Nominal<string, 'TagName'>;
 * ```
 * Symbol.species 是一個非常機智的 Symbol，
 * 它指向了一個類的建構函式，這允許類能夠建立屬於自己的、某個方法的新版本。
 */
export type Nominal<T, Name extends string> = T & {
	/** The 'name' or species of the nominal.
	 * Name為自訂類型名稱(字串), T為基礎類型
	 * & 為intersection types, 將T與{[Symbol.species]: Name;}的屬性聯集
	 * */
	[Symbol.species]: Name;
};
