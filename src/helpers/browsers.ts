import { isRunningOnClientSide } from './is-running-on-client-side';

export function isFF(): boolean {
	// firefox browser
	if (!isRunningOnClientSide) {
		return false;
	}
	return window.navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
}

export function isIOS(): boolean {
	// safari browser
	if (!isRunningOnClientSide) {
		return false;
	}
	// eslint-disable-next-line deprecation/deprecation
	return /iPhone|iPad|iPod/.test(window.navigator.platform);
}

export function isChrome(): boolean {
	// Chrome browser
	if (!isRunningOnClientSide) {
		return false;
	}
	return window.chrome !== undefined;
}

