import { Coordinate } from './coordinate';

/**
 * Represents a point on the chart.
 * Coordinate是數字的名目類型
 */
export interface Point {
	/**
	 * The x coordinate.
	 */
	readonly x: Coordinate;
	/**
	 * The y coordinate.
	 */
	readonly y: Coordinate;
}
