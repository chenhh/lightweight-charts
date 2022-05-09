import { assert, ensureDefined, ensureNotNull } from '../helpers/assertions';
import { Delegate } from '../helpers/delegate';
import { IDestroyable } from '../helpers/idestroyable';
import { ISubscription } from '../helpers/isubscription';
import { clone, DeepPartial } from '../helpers/strict-type-checks';

import { ChartModel, ChartOptions, OverlayPriceScaleOptions, VisiblePriceScaleOptions } from './chart-model';
import { DefaultPriceScaleId, isDefaultPriceScale } from './default-price-scale';
import { Grid } from './grid';
import { IPriceDataSource } from './iprice-data-source';
import { PriceScale, PriceScaleOptions, PriceScaleState } from './price-scale';
import { sortSources } from './sort-sources';
import { TimeScale } from './time-scale';

export const DEFAULT_STRETCH_FACTOR = 1000;

export type PriceScalePosition = 'left' | 'right' | 'overlay';

interface MinMaxOrderInfo {
	minZOrder: number;
	maxZOrder: number;
}

export class Pane implements IDestroyable {
	private readonly _timeScale: TimeScale;	// 在ctor中指定，通常指向chart model的time scale物件
	private readonly _model: ChartModel;	// 在ctor中指定，通常指向parent chart model
	private readonly _grid: Grid;			// 背景網格線

	private _dataSources: IPriceDataSource[] = [];	// 資料此處只有屬性和內容，繪圖不在Pane中?
	private _overlaySourcesByScaleId: Map<string, IPriceDataSource[]> = new Map();

	private _height: number = 0;
	private _width: number = 0;
	private _stretchFactor: number = DEFAULT_STRETCH_FACTOR;	// 有預設值，而在chart model中會用2倍的預設值
	private _cachedOrderedSources: readonly IPriceDataSource[] | null = null;

	private _destroyed: Delegate = new Delegate();

	private _leftPriceScale: PriceScale;	// 左側price scale, 預設不可見
	private _rightPriceScale: PriceScale;	// 右側price scale, 預設可見

	public constructor(timeScale: TimeScale, model: ChartModel) {
		/**
		 * Pane為Chart model的子組件，因此在ctor中的chart model指向parent
		 * 通常在chart model的ctor中的createpane()時被呼叫產生新的Pane
		 * 而timeScale使用chart model中相同的實例
		 */
		this._timeScale = timeScale;	// 指向parent model中的time scale
		this._model = model;			// 指向parent model
		this._grid = new Grid(this);	// 網格

		const options = model.options();

		// 左側與右側的price scale物件
		this._leftPriceScale = this._createPriceScale(DefaultPriceScaleId.Left, options.leftPriceScale);
		this._rightPriceScale = this._createPriceScale(DefaultPriceScaleId.Right, options.rightPriceScale);

		// 左側與右側的price axis事件處理
		this._leftPriceScale.modeChanged().subscribe(this._onPriceScaleModeChanged.bind(this, this._leftPriceScale), this);
		this._rightPriceScale.modeChanged().subscribe(this._onPriceScaleModeChanged.bind(this, this._rightPriceScale), this);

		this.applyScaleOptions(options);
	}

	public applyScaleOptions(options: DeepPartial<ChartOptions>): void {
		/* 選項中有四個部份和Pane有關，全部處理 */
		if (options.leftPriceScale) {
			this._leftPriceScale.applyOptions(options.leftPriceScale);
		}
		if (options.rightPriceScale) {
			this._rightPriceScale.applyOptions(options.rightPriceScale);
		}
		if (options.localization) {
			this._leftPriceScale.updateFormatter();
			this._rightPriceScale.updateFormatter();
		}
		if (options.overlayPriceScales) {
			const sourceArrays = Array.from(this._overlaySourcesByScaleId.values());
			for (const arr of sourceArrays) {
				const priceScale = ensureNotNull(arr[0].priceScale());
				priceScale.applyOptions(options.overlayPriceScales);
				if (options.localization) {
					priceScale.updateFormatter();
				}
			}
		}
	}

	public priceScaleById(id: string): PriceScale | null {
		/**
		 * id通常是left ,right或其它使用者自訂的名稱
		 */
		switch (id) {
			case DefaultPriceScaleId.Left: {
				return this._leftPriceScale;
			}
			case DefaultPriceScaleId.Right: {
				return this._rightPriceScale;
			}
		}
		if (this._overlaySourcesByScaleId.has(id)) {
			return ensureDefined(this._overlaySourcesByScaleId.get(id))[0].priceScale();
		}
		return null;
	}

	public destroy(): void {
		this.model().priceScalesOptionsChanged().unsubscribeAll(this);

		this._leftPriceScale.modeChanged().unsubscribeAll(this);
		this._rightPriceScale.modeChanged().unsubscribeAll(this);

		this._dataSources.forEach((source: IPriceDataSource) => {
			if (source.destroy) {
				source.destroy();
			}
		});
		this._destroyed.fire();
	}

	public stretchFactor(): number {
		/* stretchFactor getter */
		return this._stretchFactor;
	}

	public setStretchFactor(factor: number): void {
		/* stretchFactor setter */
		this._stretchFactor = factor;
	}

	public model(): ChartModel {
		/* model getter */
		return this._model;
	}

	public width(): number {
		/* width getter */
		return this._width;
	}

	public height(): number {
		/* height getter */
		return this._height;
	}

	public setWidth(width: number): void {
		/*
			width setter
			改變寬度時，data繪圖的大小也要改變
		*/
		this._width = width;
		this.updateAllSources();
	}

	public setHeight(height: number): void {
		/*
			height setter
			改變高度時，price axis高度和間距也要改變
		*/
		this._height = height;

		this._leftPriceScale.setHeight(height);
		this._rightPriceScale.setHeight(height);

		// process overlays
		this._dataSources.forEach((ds: IPriceDataSource) => {
			if (this.isOverlay(ds)) {
				const priceScale = ds.priceScale();
				if (priceScale !== null) {
					priceScale.setHeight(height);
				}
			}
		});

		this.updateAllSources();
	}

	public dataSources(): readonly IPriceDataSource[] {
		/* data source getter */
		return this._dataSources;
	}

	public isOverlay(source: IPriceDataSource): boolean {
		const priceScale = source.priceScale();
		if (priceScale === null) {
			return true;
		}
		return this._leftPriceScale !== priceScale && this._rightPriceScale !== priceScale;
	}

	public addDataSource(source: IPriceDataSource, targetScaleId: string, zOrder?: number): void {
		/* 新增data source時，加在最上層 (z-index最大值+1) */
		const targetZOrder = (zOrder !== undefined) ? zOrder : this._getZOrderMinMax().maxZOrder + 1;
		this._insertDataSource(source, targetScaleId, targetZOrder);
	}

	public removeDataSource(source: IPriceDataSource): void {
		/* 移除data source時，要調整id */
		const index = this._dataSources.indexOf(source);
		assert(index !== -1, 'removeDataSource: invalid data source');

		this._dataSources.splice(index, 1);

		const priceScaleId = ensureNotNull(source.priceScale()).id();
		if (this._overlaySourcesByScaleId.has(priceScaleId)) {
			const overlaySources = ensureDefined(this._overlaySourcesByScaleId.get(priceScaleId));
			const overlayIndex = overlaySources.indexOf(source);
			if (overlayIndex !== -1) {
				overlaySources.splice(overlayIndex, 1);
				if (overlaySources.length === 0) {
					this._overlaySourcesByScaleId.delete(priceScaleId);
				}
			}
		}

		const priceScale = source.priceScale();
		// if source has owner, it returns owner's price scale
		// and it does not have source in their list
		if (priceScale && priceScale.dataSources().indexOf(source) >= 0) {
			priceScale.removeDataSource(source);
		}

		if (priceScale !== null) {
			priceScale.invalidateSourcesCache();
			this.recalculatePriceScale(priceScale);
		}

		this._cachedOrderedSources = null;
	}

	public priceScalePosition(priceScale: PriceScale): PriceScalePosition {
		if (priceScale === this._leftPriceScale) {
			return 'left';
		}
		if (priceScale === this._rightPriceScale) {
			return 'right';
		}

		return 'overlay';
	}

	public leftPriceScale(): PriceScale {
		/* leftPriceScale getter */
		return this._leftPriceScale;
	}

	public rightPriceScale(): PriceScale {
		/* rightPriceScale getter */
		return this._rightPriceScale;
	}

	public startScalePrice(priceScale: PriceScale, x: number): void {
		priceScale.startScale(x);
	}

	public scalePriceTo(priceScale: PriceScale, x: number): void {
		priceScale.scaleTo(x);

		// TODO: be more smart and update only affected views
		this.updateAllSources();
	}

	public endScalePrice(priceScale: PriceScale): void {
		priceScale.endScale();
	}

	public startScrollPrice(priceScale: PriceScale, x: number): void {
		priceScale.startScroll(x);
	}

	public scrollPriceTo(priceScale: PriceScale, x: number): void {
		priceScale.scrollTo(x);
		this.updateAllSources();
	}

	public endScrollPrice(priceScale: PriceScale): void {
		priceScale.endScroll();
	}

	public updateAllSources(): void {
		this._dataSources.forEach((source: IPriceDataSource) => {
			source.updateAllViews();
		});
	}

	public defaultPriceScale(): PriceScale {
		let priceScale: PriceScale | null = null;

		if (this._model.options().rightPriceScale.visible && this._rightPriceScale.dataSources().length !== 0) {
			priceScale = this._rightPriceScale;
		} else if (this._model.options().leftPriceScale.visible && this._leftPriceScale.dataSources().length !== 0) {
			priceScale = this._leftPriceScale;
		} else if (this._dataSources.length !== 0) {
			priceScale = this._dataSources[0].priceScale();
		}

		if (priceScale === null) {
			priceScale = this._rightPriceScale;
		}

		return priceScale;
	}

	public defaultVisiblePriceScale(): PriceScale | null {
		let priceScale: PriceScale | null = null;

		if (this._model.options().rightPriceScale.visible) {
			priceScale = this._rightPriceScale;
		} else if (this._model.options().leftPriceScale.visible) {
			priceScale = this._leftPriceScale;
		}
		return priceScale;
	}

	public recalculatePriceScale(priceScale: PriceScale | null): void {
		if (priceScale === null || !priceScale.isAutoScale()) {
			return;
		}

		this._recalculatePriceScaleImpl(priceScale);
	}

	public resetPriceScale(priceScale: PriceScale): void {
		const visibleBars = this._timeScale.visibleStrictRange();
		priceScale.setMode({ autoScale: true });
		if (visibleBars !== null) {
			priceScale.recalculatePriceRange(visibleBars);
		}
		this.updateAllSources();
	}

	public momentaryAutoScale(): void {
		/**
		 * 在chart widget的_drawImpl()->applyMomentaryAutoScale()呼叫，
		 * 會依mask invalidation中，autoscale=true的設定呼叫
		 */
		this._recalculatePriceScaleImpl(this._leftPriceScale);
		this._recalculatePriceScaleImpl(this._rightPriceScale);
	}

	public recalculate(): void {
		this.recalculatePriceScale(this._leftPriceScale);
		this.recalculatePriceScale(this._rightPriceScale);

		this._dataSources.forEach((ds: IPriceDataSource) => {
			if (this.isOverlay(ds)) {
				this.recalculatePriceScale(ds.priceScale());
			}
		});

		this.updateAllSources();
		this._model.lightUpdate();
	}

	public orderedSources(): readonly IPriceDataSource[] {
		if (this._cachedOrderedSources === null) {
			this._cachedOrderedSources = sortSources(this._dataSources);
		}

		return this._cachedOrderedSources;
	}

	public onDestroyed(): ISubscription {
		return this._destroyed;
	}

	public grid(): Grid {
		return this._grid;
	}

	private _recalculatePriceScaleImpl(priceScale: PriceScale): void {
		/**
		 * momentaryAutoScale()中，會對left, right price scale呼叫此函數
		 */
			// TODO: can use this checks
			// 取得price scale中的data source list
		const sourceForAutoScale = priceScale.sourcesForAutoScale();

		// 若 source存在，且 pane的time scale不為空, 更新price scale
		if (sourceForAutoScale && sourceForAutoScale.length > 0 && !this._timeScale.isEmpty()) {
			const visibleBars = this._timeScale.visibleStrictRange();
			if (visibleBars !== null) {
				priceScale.recalculatePriceRange(visibleBars);
			}
		}
		// 更新price scale中，data source的所有view
		priceScale.updateAllViews();
	}

	private _getZOrderMinMax(): MinMaxOrderInfo {
		/* 取data source中, z-index的最大與最小值 */
		const sources = this.orderedSources();
		if (sources.length === 0) {
			return { minZOrder: 0, maxZOrder: 0 };
		}

		let minZOrder = 0;
		let maxZOrder = 0;
		for (let j = 0; j < sources.length; j++) {
			const ds = sources[j];
			const zOrder = ds.zorder();
			if (zOrder !== null) {
				if (zOrder < minZOrder) {
					minZOrder = zOrder;
				}

				if (zOrder > maxZOrder) {
					maxZOrder = zOrder;
				}
			}
		}

		return { minZOrder: minZOrder, maxZOrder: maxZOrder };
	}

	private _insertDataSource(source: IPriceDataSource, priceScaleId: string, zOrder: number): void {
		let priceScale = this.priceScaleById(priceScaleId);

		if (priceScale === null) {
			priceScale = this._createPriceScale(priceScaleId, this._model.options().overlayPriceScales);
		}

		this._dataSources.push(source);
		if (!isDefaultPriceScale(priceScaleId)) {
			const overlaySources = this._overlaySourcesByScaleId.get(priceScaleId) || [];
			overlaySources.push(source);
			this._overlaySourcesByScaleId.set(priceScaleId, overlaySources);
		}

		priceScale.addDataSource(source);
		source.setPriceScale(priceScale);

		source.setZorder(zOrder);

		this.recalculatePriceScale(priceScale);

		this._cachedOrderedSources = null;
	}

	private _onPriceScaleModeChanged(priceScale: PriceScale, oldMode: PriceScaleState, newMode: PriceScaleState): void {
		if (oldMode.mode === newMode.mode) {
			return;
		}

		// momentary auto scale if we toggle percentage/indexedTo100 mode
		this._recalculatePriceScaleImpl(priceScale);
	}

	private _createPriceScale(id: string, options: OverlayPriceScaleOptions | VisiblePriceScaleOptions): PriceScale {
		// 設定選項
		const actualOptions: PriceScaleOptions = { visible: true, autoScale: true, ...clone(options) };
		// 建立price scale物件
		const priceScale = new PriceScale(
			id,
			actualOptions,
			this._model.options().layout,
			this._model.options().localization
		);
		priceScale.setHeight(this.height());
		return priceScale;
	}
}
