/*eslint no-unused-vars: ["error", {"args": "none"}]*/
'use strict';

var PdfKitEngine = require('./pdfKitEngine');
var FontProvider = require('./fontProvider');
var LayoutBuilder = require('./layoutBuilder');
var sizes = require('./standardPageSizes');
var ImageMeasure = require('./imageMeasure');
var SVGMeasure = require('./svgMeasure');
var textDecorator = require('./textDecorator');
var TextTools = require('./textTools');
var isFunction = require('./helpers').isFunction;
var isString = require('./helpers').isString;
var isNumber = require('./helpers').isNumber;
var isBoolean = require('./helpers').isBoolean;
var isArray = require('./helpers').isArray;
var isUndefined = require('./helpers').isUndefined;
var isPattern = require('./helpers').isPattern;
var getPattern = require('./helpers').getPattern;
var SVGtoPDF = require('./3rd-party/svg-to-pdfkit');

var findFont = function (fonts, requiredFonts, defaultFont) {
	for (var i = 0; i < requiredFonts.length; i++) {
		var requiredFont = requiredFonts[i].toLowerCase();

		for (var font in fonts) {
			if (font.toLowerCase() === requiredFont) {
				return font;
			}
		}
	}

	return defaultFont;
};

////////////////////////////////////////
// PdfPrinter

/**
 * @class Creates an instance of a PdfPrinter which turns document definition into a pdf
 *
 * @param {Object} fontDescriptors font definition dictionary
 *
 * @example
 * var fontDescriptors = {
 *	Roboto: {
 *		normal: 'fonts/Roboto-Regular.ttf',
 *		bold: 'fonts/Roboto-Medium.ttf',
 *		italics: 'fonts/Roboto-Italic.ttf',
 *		bolditalics: 'fonts/Roboto-MediumItalic.ttf'
 *	}
 * };
 *
 * var printer = new PdfPrinter(fontDescriptors);
 */
function PdfPrinter(fontDescriptors) {
	this.fontDescriptors = fontDescriptors;
}

const appendDocMetadata = (doc) => {
  const xmp = `
  <?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>
  <x:xmpmeta xmlns:x="adobe:ns:meta/">
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
          <rdf:Description xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/" rdf:about="">
              <pdfaid:part>3</pdfaid:part>
              <pdfaid:conformance>B</pdfaid:conformance>
          </rdf:Description>
      </rdf:RDF>
  </x:xmpmeta>
  <?xpacket end="w"?>
`;
  const metadata = xmp.trim();
  const refMetadata = doc.ref({
    Length: metadata.length,
    Type: 'Metadata',
    Subtype: 'XML',
  });
  refMetadata.compress = false;
  refMetadata.write(Buffer.from(metadata, 'utf-8'));
  refMetadata.end();
  doc._root.data.Metadata = refMetadata;
};

const appendColorProfiles = (doc) => {
  const SRGB_IEC61966_ICC_PROFILE_B64 = 'AAAL7AAAAAACAAAAbW50clJHQiBYWVogB9kAAwAbABUAJQAtYWNzcAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAEAAPbWAAEAAAAA0y0AAAAAyVvWN+ldijsN84+ZwTIDiQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQZGVzYwAAAUQAAAB9YlhZWgAAAcQAAAAUYlRSQwAAAdgAAAgMZG1kZAAACeQAAACIZ1hZWgAACmwAAAAUZ1RSQwAAAdgAAAgMbHVtaQAACoAAAAAUbWVhcwAACpQAAAAkYmtwdAAACrgAAAAUclhZWgAACswAAAAUclRSQwAAAdgAAAgMdGVjaAAACuAAAAAMdnVlZAAACuwAAACHd3RwdAAAC3QAAAAUY3BydAAAC4gAAAA3Y2hhZAAAC8AAAAAsZGVzYwAAAAAAAAAjc1JHQiBJRUM2MTk2Ni0yLTEgbm8gYmxhY2sgc2NhbGluZwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABYWVogAAAAAAAAJKAAAA+EAAC2z2N1cnYAAAAAAAAEAAMzAzgDPQNCA0cDTANRA1YDWwNgA2UDaQNtA3IDdwN8A4EDhgOLA5ADlQOaA58DpAOpA64DswO4A7wDwQPGA8sD0APVA9oD3wPjA+gD7QPyA/cD/AQBBAYECwQQBBUEGwQgBCYEKwQxBDcEPQRDBEkETwRVBFoEYQRnBG0EdAR7BIEEiASPBJYEnQSkBKoEsQS5BMAEyATPBNcE3wTnBO8E9gT+BQYFDgUWBR8FJwUwBTkFQQVJBVIFWwVkBW0FdwWABYkFkgWcBaUFrwW5BcMFzQXXBeEF6wX1Bf8GCgYVBh8GKgY0Bj8GSgZWBmEGbAZ4BoIGjgaaBqYGsga+BsoG1QbhBu4G+gcHBxMHHwcsBzkHRgdTB2EHbQd6B4gHlgejB7EHvgfMB9oH6Af3CAUIEwghCDAIPwhOCFwIawh6CIkImQinCLcIxwjWCOYI9gkFCRYJJgk2CUcJVglnCXgJiQmZCaoJuwnNCd4J7goAChIKJAo1CkcKWQprCn0KjwqhCrQKxwrZCuwK/wsSCyQLOAtLC18LcguGC5oLrgvBC9UL6Qv+DBEMJgw7DFAMZAx5DI4MpAy4DM4M4wz5DQ4NJA06DU8NZg18DZMNqQ2/DdYN7A4DDhsOMg5IDmAOeA6ODqYOvg7VDu4PBg8fDzYPTw9oD4APmQ+yD8oP4w/9EBYQLxBJEGIQfBCWELAQyhDlEP4RGRE0EU4RaRGEEZ8RuhHWEfESDBIoEkMSYBJ8EpcStBLQEuwTCRMmE0ITYBN8E5kTtxPUE/IUEBQtFEsUaBSHFKUUwxTiFQAVHxU+FVwVfBWbFboV2hX5FhkWORZYFngWmBa5FtkW+RcaFzsXXBd8F54XvxfgGAIYIxhFGGcYiRirGM0Y8BkSGTUZVxl6GZ0ZwBnkGgYaKhpNGnEalRq5Gt0bARsmG0obbxuTG7kb3RwDHCccTRxyHJgcvRzkHQkdMB1WHXwdox3JHfEeFx4/HmUejR60HtwfAx8rH1Mfex+jH8wf9CAcIEUgbiCXIL8g6SESITwhZSGPIbkh4yINIjgiYiKNIrci4iMNIzcjYyOOI7oj5SQRJD0kaSSVJMEk7SUaJUclcyWhJc0l+iYoJlUmgyawJt8nDCc6J2knlyfGJ/QoIyhSKIEosSjgKQ8pPyluKZ8pzin+Ki8qXyqQKsAq8SsjK1MrhSu2K+csGixLLH0sryzhLRMtRi15Lawt3y4RLkUueC6rLt8vEy9GL3svry/jMBgwTDCBMLYw6zEgMVUxizHAMfYyLDJhMpgyzjMEMzwzcjOoM980FzRONIU0vTT1NSw1ZTWdNdU2DTZGNn42tzbxNyk3YjecN9Y4DzhJOIM4vTj3OTI5bDmnOeI6HTpYOpQ6zzsKO0U7gju+O/o8NjxzPK887D0pPWY9oz3gPh4+Wz6aPtc/FT9TP5I/0EAPQE1AjEDMQQtBSkGKQclCCkJJQolCyUMKQ0tDjEPMRA1ETkSPRNFFE0VURZZF2EYaRl1GoEbiRyVHaEeqR+5IMkh1SLlI/ElASYRJyUoOSlJKl0rcSyFLZkurS/BMN0x9TMJNCE1PTZVN204iTmlOsU74Tz9Phk/OUBZQXlCmUO5RNlF+UchSEVJaUqNS7FM2U39TyVQTVF1Up1TxVTxVh1XRVhxWaFa0Vv9XS1eXV+NYL1h7WMdZFFlgWa1Z+lpIWpVa4lswW35bzFwaXGhct10FXVRdo13yXkFekV7gXzBfgF/QYCBgcWDBYRJhY2G0YgViVmKoYvljS2OdY+9kQmSUZOdlOWWMZd5mMmaFZtlnLGeAZ9RoKWh9aNJpJml7adBqJWp7as9rJWt7a9FsJ2x9bNRtK22CbdluMG6Gbt5vNW+Nb+VwPXCVcO5xRnGecfdyUXKqcwNzXXO3dBB0anTEdR91eXXUdi92iXbkd0B3m3f3eFN4r3kLeWd5xHogen162Xs3e5R78nxQfK59C31pfcd+Jn6FfuN/Qn+hgAGAYIC/gR+Bf4Hggj+CoIMAg2GDw4QjhISE5oVIhamGC4ZthtCHMoeUh/eIW4i9iSCJhInoikuKr4sUi3iL3IxBjKaNC41vjdWOO46gjwaPbI/RkDiQn5EGkWyR05I6kqGTCZNxk9iUQJSplRGVeZXilkuWtJcdl4eX8JhamMSZLZmYmgOabZrYm0KbrZwZnISc8J1cnceeNJ6gnwyfeZ/loFOgwKEtoZuiCKJ2ouSjUqPBpDCknqUNpXul66ZbpsqnOqepqBqoiaj6qWup26pNqr2rL6ugrBKshKz2rWit2q5Nrr+vM6+lsBmwjLEAsXSx57JcstCzRLO5tC60orUYtY22A7Z4tu63ZLfauFC4x7k+ubW6LLqjuxq7k7wKvIK8+r1zveu+ZL7dv1a/z8BIwMLBO8G2wi/CqsMkw5/EGsSVxRDFi8YHxoLG/8d6x/fIc8jvyW3J6cpnyuTLYsvfzF3M281ZzdjOVs7Vz1TP09BT0NLRUdHS0lLS0dNS09PUVNTV1VXV19ZY1trXXNfe2GDY49ll2efaa9ru23Hb9dx43PvdgN4E3ojfDd+S4BbgnOEh4abiLeKy4zjjv+RF5MvlUuXZ5mDm5+dv5/fofukG6Y/qF+qg6ynrsuw77MTtTu3X7mHu6+928ADwivEV8aHyLPK380LzzvRa9Ob1cvX+9oz3GPel+DL4v/lO+dv6afr3+4b8FPyj/TL9wf5Q/uD/b///ZGVzYwAAAAAAAAAuSUVDIDYxOTY2LTItMSBEZWZhdWx0IFJHQiBDb2xvdXIgU3BhY2UgLSBzUkdCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAAAAAAFAAAAAAAABtZWFzAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJYWVogAAAAAAAAAxYAAAMzAAACpFhZWiAAAAAAAABvogAAOPUAAAOQc2lnIAAAAABDUlQgZGVzYwAAAAAAAAAtUmVmZXJlbmNlIFZpZXdpbmcgQ29uZGl0aW9uIGluIElFQyA2MTk2Ni0yLTEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFhZWiAAAAAAAAD21gABAAAAANMtdGV4dAAAAABDb3B5cmlnaHQgSW50ZXJuYXRpb25hbCBDb2xvciBDb25zb3J0aXVtLCAyMDA5AABzZjMyAAAAAAABDEQAAAXf///zJgAAB5QAAP2P///7of///aIAAAPbAADAdQ==';

  // PDF/A standard requires embedded color profile.
  const colorProfile = Buffer.from(SRGB_IEC61966_ICC_PROFILE_B64, 'base64');
  const refColorProfile = doc.ref({
    Length: colorProfile.length,
    N: 3,
  });
  refColorProfile.write(colorProfile);
  refColorProfile.end();

  const refOutputIntent = doc.ref({
    Type: 'OutputIntent',
    S: 'GTS_PDFA1',
    Info: new String('sRGB IEC61966-2.1'),
    OutputConditionIdentifier: new String('sRGB IEC61966-2.1'),
    DestOutputProfile: refColorProfile,
  });
  refOutputIntent.end();

  // Add manually created objects to catalog.
  doc._root.data.OutputIntents = [refOutputIntent];
};

/**
 * Executes layout engine for the specified document and renders it into a pdfkit document
 * ready to be saved.
 *
 * @param {Object} docDefinition document definition
 * @param {Object} docDefinition.content an array describing the pdf structure (for more information take a look at the examples in the /examples folder)
 * @param {Object} [docDefinition.defaultStyle] default (implicit) style definition
 * @param {Object} [docDefinition.styles] dictionary defining all styles which can be used in the document
 * @param {Object} [docDefinition.pageSize] page size (pdfkit units, A4 dimensions by default)
 * @param {Number} docDefinition.pageSize.width width
 * @param {Number} docDefinition.pageSize.height height
 * @param {Object} [docDefinition.pageMargins] page margins (pdfkit units)
 * @param {Number} docDefinition.maxPagesNumber maximum number of pages to render
 *
 * @example
 *
 * var docDefinition = {
 * 	info: {
 *		title: 'awesome Document',
 *		author: 'john doe',
 *		subject: 'subject of document',
 *		keywords: 'keywords for document',
 * 	},
 *	content: [
 *		'First paragraph',
 *		'Second paragraph, this time a little bit longer',
 *		{ text: 'Third paragraph, slightly bigger font size', fontSize: 20 },
 *		{ text: 'Another paragraph using a named style', style: 'header' },
 *		{ text: ['playing with ', 'inlines' ] },
 *		{ text: ['and ', { text: 'restyling ', bold: true }, 'them'] },
 *	],
 *	styles: {
 *		header: { fontSize: 30, bold: true }
 *	},
 *	patterns: {
 *		stripe45d: {
 *			boundingBox: [1, 1, 4, 4],
 *			xStep: 3,
 *			yStep: 3,
 *			pattern: '1 w 0 1 m 4 5 l s 2 0 m 5 3 l s'
 *		}
 *	}
 * };
 *
 * var pdfKitDoc = printer.createPdfKitDocument(docDefinition);
 *
 * pdfKitDoc.pipe(fs.createWriteStream('sample.pdf'));
 * pdfKitDoc.end();
 *
 * @return {Object} a pdfKit document object which can be saved or encode to data-url
 */
PdfPrinter.prototype.createPdfKitDocument = function (docDefinition, options) {
	options = options || {};

	docDefinition.version = docDefinition.version || '1.3';
	docDefinition.compress = isBoolean(docDefinition.compress) ? docDefinition.compress : true;
	docDefinition.images = docDefinition.images || {};
	docDefinition.pageMargins = ((docDefinition.pageMargins !== undefined) && (docDefinition.pageMargins !== null)) ? docDefinition.pageMargins : 40;

	var pageSize = fixPageSize(docDefinition.pageSize, docDefinition.pageOrientation);

	var pdfOptions = {
		size: [pageSize.width, pageSize.height],
		pdfVersion: docDefinition.version || '1.7',
		compress: docDefinition.compress,
		userPassword: docDefinition.userPassword,
		ownerPassword: docDefinition.ownerPassword,
		permissions: docDefinition.permissions,
		lang: docDefinition.language,
		fontLayoutCache: isBoolean(options.fontLayoutCache) ? options.fontLayoutCache : true,
		bufferPages: options.bufferPages || false,
		autoFirstPage: false,
		info: createMetadata(docDefinition),
		font: null,
    tagged: true
	};

	this.pdfKitDoc = PdfKitEngine.createPdfDocument(pdfOptions);

	this.fontProvider = new FontProvider(this.fontDescriptors, this.pdfKitDoc);

	var builder = new LayoutBuilder(pageSize, fixPageMargins(docDefinition.pageMargins), new ImageMeasure(this.pdfKitDoc, docDefinition.images), new SVGMeasure());

	registerDefaultTableLayouts(builder);
	if (options.tableLayouts) {
		builder.registerTableLayouts(options.tableLayouts);
	}

	var pages = builder.layoutDocument(docDefinition.content, this.fontProvider, docDefinition.styles || {}, docDefinition.defaultStyle || {
		fontSize: 12,
		font: 'Roboto'
	}, docDefinition.background, docDefinition.header, docDefinition.footer, docDefinition.images, docDefinition.watermark, docDefinition.pageBreakBefore);
	var maxNumberPages = docDefinition.maxPagesNumber || -1;
	if (isNumber(maxNumberPages) && maxNumberPages > -1) {
		pages = pages.slice(0, maxNumberPages);
	}

	// if pageSize.height is set to Infinity, calculate the actual height of the page that
	// was laid out using the height of each of the items in the page.
	if (pageSize.height === Infinity) {
		var pageHeight = calculatePageHeight(pages, docDefinition.pageMargins);
		this.pdfKitDoc.options.size = [pageSize.width, pageHeight];
	}

	var patterns = createPatterns(docDefinition.patterns || {}, this.pdfKitDoc);

	renderPages(pages, this.fontProvider, this.pdfKitDoc, patterns, options.progressCallback);

  appendDocMetadata(this.pdfKitDoc);
  appendColorProfiles(this.pdfKitDoc);

	if (options.autoPrint) {
		var printActionRef = this.pdfKitDoc.ref({
			Type: 'Action',
			S: 'Named',
			N: 'Print'
		});
		this.pdfKitDoc._root.data.OpenAction = printActionRef;
		printActionRef.end();
	}
	return this.pdfKitDoc;
};

function createMetadata(docDefinition) {
	// PDF standard has these properties reserved: Title, Author, Subject, Keywords,
	// Creator, Producer, CreationDate, ModDate, Trapped.
	// To keep the pdfmake api consistent, the info field are defined lowercase.
	// Custom properties don't contain a space.
	function standardizePropertyKey(key) {
		var standardProperties = ['Title', 'Author', 'Subject', 'Keywords',
			'Creator', 'Producer', 'CreationDate', 'ModDate', 'Trapped'];
		var standardizedKey = key.charAt(0).toUpperCase() + key.slice(1);
		if (standardProperties.indexOf(standardizedKey) !== -1) {
			return standardizedKey;
		}

		return key.replace(/\s+/g, '');
	}

	var info = {
		Producer: 'pdfmake',
		Creator: 'pdfmake'
	};

	if (docDefinition.info) {
		for (var key in docDefinition.info) {
			var value = docDefinition.info[key];
			if (value) {
				key = standardizePropertyKey(key);
				info[key] = value;
			}
		}
	}
	return info;
}

function calculatePageHeight(pages, margins) {
	function getItemHeight(item) {
		if (isFunction(item.item.getHeight)) {
			return item.item.getHeight();
		} else if (item.item._height) {
			return item.item._height;
		} else if (item.type === 'vector') {
			if (typeof item.item.y1 !== 'undefined') {
				return item.item.y1 > item.item.y2 ? item.item.y1 : item.item.y2;
			} else {
				return item.item.h;
			}
		} else {
			// TODO: add support for next item types
			return 0;
		}
	}

	function getBottomPosition(item) {
		var top = item.item.y || 0;
		var height = getItemHeight(item);
		return top + height;
	}

	var fixedMargins = fixPageMargins(margins || 40);
	var height = fixedMargins.top;

	pages.forEach(function (page) {
		page.items.forEach(function (item) {
			var bottomPosition = getBottomPosition(item);
			if (bottomPosition > height) {
				height = bottomPosition;
			}
		});
	});

	height += fixedMargins.bottom;

	return height;
}

function fixPageSize(pageSize, pageOrientation) {
	function isNeedSwapPageSizes(pageOrientation) {
		if (isString(pageOrientation)) {
			pageOrientation = pageOrientation.toLowerCase();
			return ((pageOrientation === 'portrait') && (size.width > size.height)) ||
				((pageOrientation === 'landscape') && (size.width < size.height));
		}
		return false;
	}

	// if pageSize.height is set to auto, set the height to infinity so there are no page breaks.
	if (pageSize && pageSize.height === 'auto') {
		pageSize.height = Infinity;
	}

	var size = pageSize2widthAndHeight(pageSize || 'A4');
	if (isNeedSwapPageSizes(pageOrientation)) { // swap page sizes
		size = { width: size.height, height: size.width };
	}
	size.orientation = size.width > size.height ? 'landscape' : 'portrait';
	return size;
}

function fixPageMargins(margin) {
	if (isNumber(margin)) {
		margin = { left: margin, right: margin, top: margin, bottom: margin };
	} else if (isArray(margin)) {
		if (margin.length === 2) {
			margin = { left: margin[0], top: margin[1], right: margin[0], bottom: margin[1] };
		} else if (margin.length === 4) {
			margin = { left: margin[0], top: margin[1], right: margin[2], bottom: margin[3] };
		} else {
			throw 'Invalid pageMargins definition';
		}
	}

	return margin;
}

function registerDefaultTableLayouts(layoutBuilder) {
	layoutBuilder.registerTableLayouts({
		noBorders: {
			hLineWidth: function (i) {
				return 0;
			},
			vLineWidth: function (i) {
				return 0;
			},
			paddingLeft: function (i) {
				return i && 4 || 0;
			},
			paddingRight: function (i, node) {
				return (i < node.table.widths.length - 1) ? 4 : 0;
			}
		},
		headerLineOnly: {
			hLineWidth: function (i, node) {
				if (i === 0 || i === node.table.body.length) {
					return 0;
				}
				return (i === node.table.headerRows) ? 2 : 0;
			},
			vLineWidth: function (i) {
				return 0;
			},
			paddingLeft: function (i) {
				return i === 0 ? 0 : 8;
			},
			paddingRight: function (i, node) {
				return (i === node.table.widths.length - 1) ? 0 : 8;
			}
		},
		lightHorizontalLines: {
			hLineWidth: function (i, node) {
				if (i === 0 || i === node.table.body.length) {
					return 0;
				}
				return (i === node.table.headerRows) ? 2 : 1;
			},
			vLineWidth: function (i) {
				return 0;
			},
			hLineColor: function (i) {
				return i === 1 ? 'black' : '#aaa';
			},
			paddingLeft: function (i) {
				return i === 0 ? 0 : 8;
			},
			paddingRight: function (i, node) {
				return (i === node.table.widths.length - 1) ? 0 : 8;
			}
		}
	});
}

function pageSize2widthAndHeight(pageSize) {
	if (isString(pageSize)) {
		var size = sizes[pageSize.toUpperCase()];
		if (!size) {
			throw 'Page size ' + pageSize + ' not recognized';
		}
		return { width: size[0], height: size[1] };
	}

	return pageSize;
}

function updatePageOrientationInOptions(currentPage, pdfKitDoc) {
	var previousPageOrientation = pdfKitDoc.options.size[0] > pdfKitDoc.options.size[1] ? 'landscape' : 'portrait';

	if (currentPage.pageSize.orientation !== previousPageOrientation) {
		var width = pdfKitDoc.options.size[0];
		var height = pdfKitDoc.options.size[1];
		pdfKitDoc.options.size = [height, width];
	}
}

function renderPages(pages, fontProvider, pdfKitDoc, patterns, progressCallback) {
	pdfKitDoc._pdfMakePages = pages;
	pdfKitDoc.addPage();

	var totalItems = 0;
	if (progressCallback) {
		pages.forEach(function (page) {
			totalItems += page.items.length;
		});
	}

	var renderedItems = 0;
	progressCallback = progressCallback || function () {
	};

	for (var i = 0; i < pages.length; i++) {
		if (i > 0) {
			updatePageOrientationInOptions(pages[i], pdfKitDoc);
			pdfKitDoc.addPage(pdfKitDoc.options);
		}

		var page = pages[i];
		for (var ii = 0, il = page.items.length; ii < il; ii++) {
			var item = page.items[ii];
			switch (item.type) {
				case 'vector':
					renderVector(item.item, patterns, pdfKitDoc);
					break;
				case 'line':
					renderLine(item.item, item.item.x, item.item.y, patterns, pdfKitDoc);
					break;
				case 'image':
					renderImage(item.item, item.item.x, item.item.y, pdfKitDoc);
					break;
				case 'svg':
					renderSVG(item.item, item.item.x, item.item.y, pdfKitDoc, fontProvider);
					break;
				case 'beginClip':
					beginClip(item.item, pdfKitDoc);
					break;
				case 'endClip':
					endClip(pdfKitDoc);
					break;
			}
			renderedItems++;
			progressCallback(renderedItems / totalItems);
		}
		if (page.watermark) {
			renderWatermark(page, pdfKitDoc);
		}
	}
}

/**
 * Shift the "y" height of the text baseline up or down (superscript or subscript,
 * respectively). The exact shift can / should be changed according to standard
 * conventions.
 *
 * @param {number} y
 * @param {any} inline
 */
function offsetText(y, inline) {
	var newY = y;
	if (inline.sup) {
		newY -= inline.fontSize * 0.75;
	}
	if (inline.sub) {
		newY += inline.fontSize * 0.35;
	}
	return newY;
}

function renderLine(line, x, y, patterns, pdfKitDoc) {
	function preparePageNodeRefLine(_pageNodeRef, inline) {
		var newWidth;
		var diffWidth;
		var textTools = new TextTools(null);

		if (isUndefined(_pageNodeRef.positions)) {
			throw 'Page reference id not found';
		}

		var pageNumber = _pageNodeRef.positions[0].pageNumber.toString();

		inline.text = pageNumber;
		newWidth = textTools.widthOfString(inline.text, inline.font, inline.fontSize, inline.characterSpacing, inline.fontFeatures);
		diffWidth = inline.width - newWidth;
		inline.width = newWidth;

		switch (inline.alignment) {
			case 'right':
				inline.x += diffWidth;
				break;
			case 'center':
				inline.x += diffWidth / 2;
				break;
		}
	}

	if (line._pageNodeRef) {
		preparePageNodeRefLine(line._pageNodeRef, line.inlines[0]);
	}

	x = x || 0;
	y = y || 0;

	var lineHeight = line.getHeight();
	var ascenderHeight = line.getAscenderHeight();
	var descent = lineHeight - ascenderHeight;

	textDecorator.drawBackground(line, x, y, patterns, pdfKitDoc);

	//TODO: line.optimizeInlines();
	for (var i = 0, l = line.inlines.length; i < l; i++) {
		var inline = line.inlines[i];
		var shiftToBaseline = lineHeight - ((inline.font.ascender / 1000) * inline.fontSize) - descent;

		if (inline._pageNodeRef) {
			preparePageNodeRefLine(inline._pageNodeRef, inline);
		}

		var options = {
			lineBreak: false,
			textWidth: inline.width,
			characterSpacing: inline.characterSpacing,
			wordCount: 1,
			link: inline.link
		};

		if (inline.linkToDestination) {
			options.goTo = inline.linkToDestination;
		}

		if (line.id && i === 0) {
			options.destination = line.id;
		}

		if (inline.fontFeatures) {
			options.features = inline.fontFeatures;
		}

		var opacity = isNumber(inline.opacity) ? inline.opacity : 1;
		pdfKitDoc.opacity(opacity);
		pdfKitDoc.fill(inline.color || 'black');

		pdfKitDoc._font = inline.font;
		pdfKitDoc.fontSize(inline.fontSize);

		var shiftedY = offsetText(y + shiftToBaseline, inline);
		pdfKitDoc.text(inline.text, x + inline.x, shiftedY, options);

		if (inline.linkToPage) {
			var _ref = pdfKitDoc.ref({ Type: 'Action', S: 'GoTo', D: [inline.linkToPage, 0, 0] }).end();
			pdfKitDoc.annotate(x + inline.x, shiftedY, inline.width, inline.height, {
				Subtype: 'Link',
				Dest: [inline.linkToPage - 1, 'XYZ', null, null, null]
			});
		}

	}
	// Decorations won't draw correctly for superscript
	textDecorator.drawDecorations(line, x, y, pdfKitDoc);
}

function renderWatermark(page, pdfKitDoc) {
	var watermark = page.watermark;

	pdfKitDoc.fill(watermark.color);
	pdfKitDoc.opacity(watermark.opacity);

	pdfKitDoc.save();

	pdfKitDoc.rotate(watermark.angle, { origin: [pdfKitDoc.page.width / 2, pdfKitDoc.page.height / 2] });

	var x = pdfKitDoc.page.width / 2 - watermark._size.size.width / 2;
	var y = pdfKitDoc.page.height / 2 - watermark._size.size.height / 2;

	pdfKitDoc._font = watermark.font;
	pdfKitDoc.fontSize(watermark.fontSize);
	pdfKitDoc.text(watermark.text, x, y, { lineBreak: false });

	pdfKitDoc.restore();
}

function renderVector(vector, patterns, pdfKitDoc) {
	//TODO: pdf optimization (there's no need to write all properties everytime)
	pdfKitDoc.lineWidth(vector.lineWidth || 1);
	if (vector.dash) {
		pdfKitDoc.dash(vector.dash.length, { space: vector.dash.space || vector.dash.length, phase: vector.dash.phase || 0 });
	} else {
		pdfKitDoc.undash();
	}
	pdfKitDoc.lineJoin(vector.lineJoin || 'miter');
	pdfKitDoc.lineCap(vector.lineCap || 'butt');

	//TODO: clipping

	var gradient = null;

	switch (vector.type) {
		case 'ellipse':
			pdfKitDoc.ellipse(vector.x, vector.y, vector.r1, vector.r2);

			if (vector.linearGradient) {
				gradient = pdfKitDoc.linearGradient(vector.x - vector.r1, vector.y, vector.x + vector.r1, vector.y);
			}
			break;
		case 'rect':
			if (vector.r) {
				pdfKitDoc.roundedRect(vector.x, vector.y, vector.w, vector.h, vector.r);
			} else {
				pdfKitDoc.rect(vector.x, vector.y, vector.w, vector.h);
			}

			if (vector.linearGradient) {
				gradient = pdfKitDoc.linearGradient(vector.x, vector.y, vector.x + vector.w, vector.y);
			}
			break;
		case 'line':
			pdfKitDoc.moveTo(vector.x1, vector.y1);
			pdfKitDoc.lineTo(vector.x2, vector.y2);
			break;
		case 'polyline':
			if (vector.points.length === 0) {
				break;
			}

			pdfKitDoc.moveTo(vector.points[0].x, vector.points[0].y);
			for (var i = 1, l = vector.points.length; i < l; i++) {
				pdfKitDoc.lineTo(vector.points[i].x, vector.points[i].y);
			}

			if (vector.points.length > 1) {
				var p1 = vector.points[0];
				var pn = vector.points[vector.points.length - 1];

				if (vector.closePath || p1.x === pn.x && p1.y === pn.y) {
					pdfKitDoc.closePath();
				}
			}
			break;
		case 'path':
			pdfKitDoc.path(vector.d);
			break;
	}

	if (vector.linearGradient && gradient) {
		var step = 1 / (vector.linearGradient.length - 1);

		for (var i = 0; i < vector.linearGradient.length; i++) {
			gradient.stop(i * step, vector.linearGradient[i]);
		}

		vector.color = gradient;
	}

	if (isPattern(vector.color)) {
		vector.color = getPattern(vector.color, patterns);
	}

	var fillOpacity = isNumber(vector.fillOpacity) ? vector.fillOpacity : 1;
	var strokeOpacity = isNumber(vector.strokeOpacity) ? vector.strokeOpacity : 1;

	if (vector.color && vector.lineColor) {
		pdfKitDoc.fillColor(vector.color, fillOpacity);
		pdfKitDoc.strokeColor(vector.lineColor, strokeOpacity);
		pdfKitDoc.fillAndStroke();
	} else if (vector.color) {
		pdfKitDoc.fillColor(vector.color, fillOpacity);
		pdfKitDoc.fill();
	} else {
		pdfKitDoc.strokeColor(vector.lineColor || 'black', strokeOpacity);
		pdfKitDoc.stroke();
	}
}

function renderImage(image, x, y, pdfKitDoc) {
	var opacity = isNumber(image.opacity) ? image.opacity : 1;
	pdfKitDoc.opacity(opacity);
	if (image.cover) {
		var align = image.cover.align || 'center';
		var valign = image.cover.valign || 'center';
		var width = image.cover.width ? image.cover.width : image.width;
		var height = image.cover.height ? image.cover.height : image.height;
		pdfKitDoc.save();
		pdfKitDoc.rect(image.x, image.y, width, height).clip();
		pdfKitDoc.image(image.image, image.x, image.y, { cover: [width, height], align: align, valign: valign });
		pdfKitDoc.restore();
	} else {
		pdfKitDoc.image(image.image, image.x, image.y, { width: image._width, height: image._height });
	}
	if (image.link) {
		pdfKitDoc.link(image.x, image.y, image._width, image._height, image.link);
	}
	if (image.linkToPage) {
		pdfKitDoc.ref({ Type: 'Action', S: 'GoTo', D: [image.linkToPage, 0, 0] }).end();
		pdfKitDoc.annotate(image.x, image.y, image._width, image._height, { Subtype: 'Link', Dest: [image.linkToPage - 1, 'XYZ', null, null, null] });
	}
	if (image.linkToDestination) {
		pdfKitDoc.goTo(image.x, image.y, image._width, image._height, image.linkToDestination);
	}
}

function renderSVG(svg, x, y, pdfKitDoc, fontProvider) {
	var options = Object.assign({ width: svg._width, height: svg._height, assumePt: true }, svg.options);
	options.fontCallback = function (family, bold, italic) {
		var fontsFamily = family.split(',').map(function (f) { return f.trim().replace(/('|")/g, ''); });
		var font = findFont(fontProvider.fonts, fontsFamily, svg.font || 'Roboto');

		var fontFile = fontProvider.getFontFile(font, bold, italic);
		if (fontFile === null) {
			var type = fontProvider.getFontType(bold, italic);
			throw new Error('Font \'' + font + '\' in style \'' + type + '\' is not defined in the font section of the document definition.');
		}

		return fontFile;
	};

	SVGtoPDF(pdfKitDoc, svg.svg, svg.x, svg.y, options);
}

function beginClip(rect, pdfKitDoc) {
	pdfKitDoc.save();
	pdfKitDoc.addContent('' + rect.x + ' ' + rect.y + ' ' + rect.width + ' ' + rect.height + ' re');
	pdfKitDoc.clip();
}

function endClip(pdfKitDoc) {
	pdfKitDoc.restore();
}

function createPatterns(patternDefinitions, pdfKitDoc) {
	var patterns = {};
	Object.keys(patternDefinitions).forEach(function (p) {
		var pattern = patternDefinitions[p];
		patterns[p] = pdfKitDoc.pattern(pattern.boundingBox, pattern.xStep, pattern.yStep, pattern.pattern, pattern.colored);
	});
	return patterns;
}

module.exports = PdfPrinter;
