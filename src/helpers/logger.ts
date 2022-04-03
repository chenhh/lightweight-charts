/// <reference types="_build-time-constants" />

export function warn(msg: string): void {
	/**
	 * development模式時，開啟warning log
	 */
	if (process.env.NODE_ENV === 'development') {
		// eslint-disable-next-line no-console
		console.warn(msg);
	}
}
