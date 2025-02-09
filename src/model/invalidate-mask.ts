import { LogicalRange } from '../model/time-data';

export const enum InvalidationLevel {
	None = 0,
	Cursor = 1,
	Light = 2,
	Full = 3,
}

export interface PaneInvalidation {
	// 指定資料或繪圖更新時, 元素失效的層級, 越高級需要更新的元素越多
	level: InvalidationLevel;
	autoScale?: boolean;
}

function mergePaneInvalidation(beforeValue: PaneInvalidation | undefined, newValue: PaneInvalidation): PaneInvalidation {
	if (beforeValue === undefined) {
		return newValue;
	}
	const level = Math.max(beforeValue.level, newValue.level);
	const autoScale = beforeValue.autoScale || newValue.autoScale;
	return { level, autoScale };
}

export const enum TimeScaleInvalidationType {
	FitContent,
	ApplyRange,
	ApplyBarSpacing,
	ApplyRightOffset,
	Reset,
}

export interface TimeScaleApplyRangeInvalidation {
	type: TimeScaleInvalidationType.ApplyRange;
	value: LogicalRange;
}

export interface TimeScaleFitContentInvalidation {
	type: TimeScaleInvalidationType.FitContent;
}

export interface TimeScaleApplyRightOffsetInvalidation {
	type: TimeScaleInvalidationType.ApplyRightOffset;
	value: number;
}

export interface TimeScaleApplyBarSpacingInvalidation {
	type: TimeScaleInvalidationType.ApplyBarSpacing;
	value: number;
}

export interface TimeScaleResetInvalidation {
	type: TimeScaleInvalidationType.Reset;
}

// 對應到TimeScale中的method
export type TimeScaleInvalidation =
	| TimeScaleApplyRangeInvalidation
	| TimeScaleFitContentInvalidation
	| TimeScaleApplyRightOffsetInvalidation
	| TimeScaleApplyBarSpacingInvalidation
	| TimeScaleResetInvalidation;

export class InvalidateMask {
	// 記錄pane(by index)與對應的{invalidation level, autoscale}
	private _invalidatedPanes: Map<number, PaneInvalidation> = new Map();
	private _globalLevel: InvalidationLevel;
	private _timeScaleInvalidations: TimeScaleInvalidation[] = [];

	public constructor(globalLevel: InvalidationLevel) {
		/** 全局失效等級, 有{None, Cursor, Light, Full} 4個等級
			在chart model的createPane用是Full建構mask
		 */
		this._globalLevel = globalLevel;
	}

	public invalidatePane(paneIndex: number, invalidation: PaneInvalidation): void {
		/**
		 * paneIndex為pane在chart model中pane list的index, 通常為0
		 * invalidation為invalidationLevel與autoscaling(bool)的介面
		 * 更新指定pane index的{invalidation, autoscale}之快取值
		 */
		const prevValue = this._invalidatedPanes.get(paneIndex);
		const newValue = mergePaneInvalidation(prevValue, invalidation);
		this._invalidatedPanes.set(paneIndex, newValue);
	}

	public fullInvalidation(): InvalidationLevel {
		return this._globalLevel;
	}

	public invalidateForPane(paneIndex: number): PaneInvalidation {
		const paneInvalidation = this._invalidatedPanes.get(paneIndex);
		if (paneInvalidation === undefined) {
			return {
				level: this._globalLevel,
			};
		}
		return {
			level: Math.max(this._globalLevel, paneInvalidation.level),
			autoScale: paneInvalidation.autoScale,
		};
	}

	public setFitContent(): void {
		// modifies both bar spacing and right offset
		this._timeScaleInvalidations = [{ type: TimeScaleInvalidationType.FitContent }];
	}

	public applyRange(range: LogicalRange): void {
		// modifies both bar spacing and right offset
		this._timeScaleInvalidations = [{ type: TimeScaleInvalidationType.ApplyRange, value: range }];
	}

	public resetTimeScale(): void {
		// modifies both bar spacing and right offset
		this._timeScaleInvalidations = [{ type: TimeScaleInvalidationType.Reset }];
	}

	public setBarSpacing(barSpacing: number): void {
		this._timeScaleInvalidations.push({ type: TimeScaleInvalidationType.ApplyBarSpacing, value: barSpacing });
	}

	public setRightOffset(offset: number): void {
		this._timeScaleInvalidations.push({ type: TimeScaleInvalidationType.ApplyRightOffset, value: offset });
	}

	public timeScaleInvalidations(): readonly TimeScaleInvalidation[] {
		/**
		 * time scale的invalidation
		 * TimeScaleInvalidation =
		 * 	| TimeScaleApplyRangeInvalidation
		 * 	| TimeScaleFitContentInvalidation
		 * 	| TimeScaleApplyRightOffsetInvalidation
		 * 	| TimeScaleApplyBarSpacingInvalidation
		 * 	| TimeScaleResetInvalidation;
		 */
		return this._timeScaleInvalidations;
	}

	public merge(other: InvalidateMask): void {
		for (const tsInvalidation of other._timeScaleInvalidations) {
			this._applyTimeScaleInvalidation(tsInvalidation);
		}

		this._globalLevel = Math.max(this._globalLevel, other._globalLevel);
		other._invalidatedPanes.forEach((invalidation: PaneInvalidation, index: number) => {
			this.invalidatePane(index, invalidation);
		});
	}

	private _applyTimeScaleInvalidation(invalidation: TimeScaleInvalidation): void {
		switch (invalidation.type) {
			case TimeScaleInvalidationType.FitContent:
				this.setFitContent();
				break;
			case TimeScaleInvalidationType.ApplyRange:
				this.applyRange(invalidation.value);
				break;
			case TimeScaleInvalidationType.ApplyBarSpacing:
				this.setBarSpacing(invalidation.value);
				break;
			case TimeScaleInvalidationType.ApplyRightOffset:
				this.setRightOffset(invalidation.value);
				break;
			case TimeScaleInvalidationType.Reset:
				this.resetTimeScale();
				break;
		}
	}
}
