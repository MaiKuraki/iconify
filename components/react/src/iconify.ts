import {
	useEffect,
	useState,
	forwardRef,
	createElement,
	type Ref,
} from 'react';
import type { IconifyJSON, IconifyIcon } from '@iconify/types';

// Core
import type { IconifyIconName } from '@iconify/utils/lib/icon/name';
import type { IconifyIconSize } from '@iconify/utils/lib/customisations/defaults';
import type { IconifyStorageFunctions } from '@iconify/core/lib/storage/functions';
import {
	iconLoaded,
	getIcon,
	addIcon,
	addCollection,
	getIconData,
	allowSimpleNames,
} from '@iconify/core/lib/storage/functions';
import { listIcons } from '@iconify/core/lib/storage/storage';
import type { IconifyBuilderFunctions } from '@iconify/core/lib/builder/functions';
import { iconToSVG as buildIcon } from '@iconify/utils/lib/svg/build';
import { replaceIDs } from '@iconify/utils/lib/svg/id';
import { calculateSize } from '@iconify/utils/lib/svg/size';
import type { IconifyIconBuildResult } from '@iconify/utils/lib/svg/build';

// API
import type {
	IconifyCustomIconLoader,
	IconifyCustomIconsLoader,
} from '@iconify/core/lib/api/types';
import type {
	IconifyAPIFunctions,
	IconifyAPIInternalFunctions,
	IconifyAPIQueryParams,
	IconifyAPICustomQueryParams,
} from '@iconify/core/lib/api/functions';
import type {
	IconifyAPIModule,
	IconifyAPISendQuery,
	IconifyAPIPrepareIconsQuery,
} from '@iconify/core/lib/api/modules';
import { setAPIModule } from '@iconify/core/lib/api/modules';
import type {
	PartialIconifyAPIConfig,
	IconifyAPIConfig,
	GetAPIConfig,
} from '@iconify/core/lib/api/config';
import {
	addAPIProvider,
	getAPIConfig,
	listAPIProviders,
} from '@iconify/core/lib/api/config';
import {
	fetchAPIModule,
	setFetch,
	getFetch,
} from '@iconify/core/lib/api/modules/fetch';
import type {
	IconifyIconLoaderCallback,
	IconifyIconLoaderAbort,
} from '@iconify/core/lib/api/icons';
import { loadIcons, loadIcon } from '@iconify/core/lib/api/icons';
import {
	setCustomIconLoader,
	setCustomIconsLoader,
} from '@iconify/core/lib/api/loaders';
import { sendAPIQuery } from '@iconify/core/lib/api/query';

// Cache
import { initBrowserStorage } from '@iconify/core/lib/browser-storage';
import { toggleBrowserCache } from '@iconify/core/lib/browser-storage/functions';
import type {
	IconifyBrowserCacheType,
	IconifyBrowserCacheFunctions,
} from '@iconify/core/lib/browser-storage/functions';

// Properties
import type {
	IconifyIconOnLoad,
	IconifyIconCustomisations,
	IconifyIconProps,
	IconifyRenderMode,
	IconProps,
	IconElement,
} from './props';

// Render SVG
import { render } from './render';
import { defaultIconProps } from '@iconify/utils/lib/icon/defaults';

/**
 * Export required types
 */
// Function sets
export {
	IconifyStorageFunctions,
	IconifyBuilderFunctions,
	IconifyBrowserCacheFunctions,
	IconifyAPIFunctions,
	IconifyAPIInternalFunctions,
};

// JSON stuff
export { IconifyIcon, IconifyJSON, IconifyIconName };

// Customisations and icon props
export {
	IconifyIconCustomisations,
	IconifyIconSize,
	IconifyRenderMode,
	IconifyIconProps,
	IconProps,
	IconifyIconOnLoad,
};

// API
export {
	IconifyAPIConfig,
	IconifyIconLoaderCallback,
	IconifyIconLoaderAbort,
	IconifyAPIModule,
	GetAPIConfig,
	IconifyAPIPrepareIconsQuery,
	IconifyAPISendQuery,
	PartialIconifyAPIConfig,
	IconifyAPIQueryParams,
	IconifyAPICustomQueryParams,
	IconifyCustomIconLoader,
	IconifyCustomIconsLoader,
};

// Builder functions
export { IconifyIconBuildResult };

/* Browser cache */
export { IconifyBrowserCacheType };

/**
 * Enable cache
 */
function enableCache(storage: IconifyBrowserCacheType): void {
	toggleBrowserCache(storage, true);
}

/**
 * Disable cache
 */
function disableCache(storage: IconifyBrowserCacheType): void {
	toggleBrowserCache(storage, false);
}

/**
 * Initialise stuff
 */
// Enable short names
allowSimpleNames(true);

// Set API module
setAPIModule('', fetchAPIModule);

/**
 * Browser stuff
 */
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
	// Set cache and load existing cache
	initBrowserStorage();

	interface WindowWithIconifyStuff {
		IconifyPreload?: IconifyJSON[] | IconifyJSON;
		IconifyProviders?: Record<string, PartialIconifyAPIConfig>;
	}
	const _window = window as WindowWithIconifyStuff;

	// Load icons from global "IconifyPreload"
	if (_window.IconifyPreload !== void 0) {
		const preload = _window.IconifyPreload;
		const err = 'Invalid IconifyPreload syntax.';
		if (typeof preload === 'object' && preload !== null) {
			(preload instanceof Array ? preload : [preload]).forEach((item) => {
				try {
					if (
						// Check if item is an object and not null/array
						typeof item !== 'object' ||
						item === null ||
						item instanceof Array ||
						// Check for 'icons' and 'prefix'
						typeof item.icons !== 'object' ||
						typeof item.prefix !== 'string' ||
						// Add icon set
						!addCollection(item)
					) {
						console.error(err);
					}
				} catch (e) {
					console.error(err);
				}
			});
		}
	}

	// Set API from global "IconifyProviders"
	if (_window.IconifyProviders !== void 0) {
		const providers = _window.IconifyProviders;
		if (typeof providers === 'object' && providers !== null) {
			for (let key in providers) {
				const err = 'IconifyProviders[' + key + '] is invalid.';
				try {
					const value = providers[key];
					if (
						typeof value !== 'object' ||
						!value ||
						value.resources === void 0
					) {
						continue;
					}
					if (!addAPIProvider(key, value)) {
						console.error(err);
					}
				} catch (e) {
					console.error(err);
				}
			}
		}
	}
}

/**
 * Component
 */
interface InternalIconProps extends IconProps {
	_ref?: Ref<IconElement> | null;
}

function IconComponent(props: InternalIconProps): JSX.Element {
	interface AbortState {
		callback?: IconifyIconLoaderAbort;
	}
	interface State {
		// Currently rendered icon
		name: string;

		// Icon data, null if missing
		data?: IconifyIcon | null;
	}

	const [mounted, setMounted] = useState(!!props.ssr);
	const [abort, setAbort] = useState<AbortState>({});

	// Get initial state
	function getInitialState(mounted: boolean): State {
		if (mounted) {
			const name = props.icon;
			if (typeof name === 'object') {
				// Icon as object
				return {
					name: '',
					data: name,
				};
			}

			const data = getIconData(name);
			if (data) {
				return {
					name,
					data,
				};
			}
		}
		return {
			name: '',
		};
	}
	const [state, setState] = useState<State>(getInitialState(!!props.ssr));

	// Cancel loading
	function cleanup() {
		const callback = abort.callback;
		if (callback) {
			callback();
			setAbort({});
		}
	}

	// Change state if it is different
	function changeState(newState: State): boolean | undefined {
		if (JSON.stringify(state) !== JSON.stringify(newState)) {
			cleanup();
			setState(newState);
			return true;
		}
	}

	// Update state
	function updateState() {
		const name = props.icon;
		if (typeof name === 'object') {
			// Icon as object
			changeState({
				name: '',
				data: name,
			});
			return;
		}

		// New icon or got icon data
		const data = getIconData(name);
		if (
			changeState({
				name,
				data,
			})
		) {
			if (data === undefined) {
				// Load icon, update state when done
				const callback = loadIcons([name], updateState);
				setAbort({
					callback,
				});
			} else if (data) {
				// Icon data is available: trigger onLoad callback if present
				props.onLoad?.(name);
			}
		}
	}

	// Mounted state, cleanup for loader
	useEffect(() => {
		setMounted(true);
		return cleanup;
	}, []);

	// Icon changed or component mounted
	useEffect(() => {
		if (mounted) {
			updateState();
		}
	}, [props.icon, mounted]);

	// Render icon
	const { name, data } = state;
	if (!data) {
		return props.children
			? (props.children as JSX.Element)
			: createElement('span', {});
	}

	return render(
		{
			...defaultIconProps,
			...data,
		},
		props,
		name
	);
}

// Component type
type IconComponentType = (props: IconProps) => JSX.Element;

/**
 * Block icon
 *
 * @param props - Component properties
 */
export const Icon = forwardRef<IconElement, IconProps>((props, ref) =>
	IconComponent({
		...props,
		_ref: ref,
	})
) as IconComponentType;

/**
 * Inline icon (has negative verticalAlign that makes it behave like icon font)
 *
 * @param props - Component properties
 */
export const InlineIcon = forwardRef<IconElement, IconProps>((props, ref) =>
	IconComponent({
		inline: true,
		...props,
		_ref: ref,
	})
) as IconComponentType;

/**
 * Internal API
 */
const _api: IconifyAPIInternalFunctions = {
	getAPIConfig,
	setAPIModule,
	sendAPIQuery,
	setFetch,
	getFetch,
	listAPIProviders,
};

/**
 * Export functions
 */
// IconifyAPIInternalFunctions
export { _api };

// IconifyAPIFunctions
export {
	addAPIProvider,
	loadIcons,
	loadIcon,
	setCustomIconLoader,
	setCustomIconsLoader,
};

// IconifyStorageFunctions
export {
	iconLoaded,
	iconLoaded as iconExists, // deprecated, kept to avoid breaking changes
	getIcon,
	listIcons,
	addIcon,
	addCollection,
};

// IconifyBuilderFunctions
export { replaceIDs, calculateSize, buildIcon };

// IconifyBrowserCacheFunctions
export { enableCache, disableCache };
