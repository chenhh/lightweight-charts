import { isChrome } from './browsers';

export function preventScrollByWheelClick(el: HTMLElement): void {
	/**
	 * wheel被點擊時的事件處理?
	 */
	if (!isChrome()) {
		return;
	}

	el.addEventListener('mousedown', (e: MouseEvent) => {
		if (e.button === MouseEventButton.Middle) {
			// prevent incorrect scrolling event
			e.preventDefault();
			return false;
		}
		return undefined;
	});
}

