/**
 * When you're trying to use the library in server-side context (for instance in SSR)
 * you don't have some browser-specific variables like navigator or window
 * and if the library will use them on the top level of the library
 * the import will fail due ReferenceError
 * thus, this allows use the navigator on the top level and being imported in server-side context as well
 * See issue #446
 *
 * 當你試圖在服務器端使用該庫時（例如在SSR中），你沒有一些瀏覽器特有的變量，例如navigator或window，
 * 如果該庫在頂層使用它們，導入將因ReferenceError而失敗，因此，這允許在頂層使用navigator並在服務器端導入。
 *
 * 在nodejs下，typeof window為undefined, 而在browser中，typeof window得到的是object
 */
// eslint-disable-next-line @typescript-eslint/tslint/config
export const isRunningOnClientSide = typeof window !== 'undefined';

