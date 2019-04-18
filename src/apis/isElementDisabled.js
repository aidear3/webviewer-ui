/**
 * Returns whether the element is disabled.
 * @method WebViewer#isElementDisabled
 * @param {string} dataElement data-element attribute value for a DOM element. To find data-element of a DOM element, refer to <a href='https://www.pdftron.com/documentation/web/guides/hiding-elements/#finding-dataelement-attribute-values' target='_blank'>Finding data-element attribute values</a>.
 * @returns {boolean} Whether the element is disabled.
 * @example const viewerElement = document.getElementById('viewer');
const instance = await WebViewer({ ... }, viewerElement);

console.log(instance.isElementDisabled('leftPanel'));
 */

import selectors from 'selectors';

export default store => dataElement => !!selectors.isElementDisabled(store.getState(), dataElement);