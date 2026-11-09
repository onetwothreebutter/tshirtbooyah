/* Tshirt Booyah theme: variant picker, color swatches, size chart and image lightbox. No dependencies. */
(function () {
  // Product page: map the option dropdowns to a variant id.
  document.querySelectorAll('[data-product-form]').forEach(function (form) {
    var root = form.closest('#details_infobox');
    var json = root && root.querySelector('[data-variants]');
    if (!json) return;
    var variants = JSON.parse(json.textContent);
    // One control per option: a dropdown, or a group of color swatch radios.
    var selects = form.querySelectorAll('select[data-option-index]');
    var swatches = form.querySelectorAll('input[type="radio"][data-option-index]');
    var swatchName = form.querySelector('[data-swatch-name]');
    var optionCount = variants.length ? variants[0].options.length : 0;
    var idInput = form.querySelector('[data-variant-id]');
    var button = form.querySelector('[data-add-button]');
    var price = root.querySelector('[data-price]');
    var mainImage = document.querySelector('[data-main-image]');
    var mainImageLink = document.querySelector('[data-main-image-link]');

    // Size menu that starts on "Choose a size" (see main-product.liquid).
    var sizeSelect = form.querySelector('[data-size-required]');
    var sizeError = form.querySelector('[data-size-error]');
    var express = form.querySelector('[data-express-checkout]');

    function showSizeError() {
      if (!sizeSelect) return;
      sizeSelect.classList.add('is-invalid');
      if (sizeError) sizeError.hidden = false;
      sizeSelect.focus();
    }
    if (sizeSelect) {
      // The select is required, so the browser stops Add to cart and fires
      // "invalid"; show our own message instead of the browser bubble.
      sizeSelect.addEventListener('invalid', function (e) {
        e.preventDefault();
        showSizeError();
      });
    }
    if (express) {
      // While locked, the Shop Pay button ignores clicks (CSS) and the
      // wrapper gets them.
      express.addEventListener('click', function () {
        if (express.classList.contains('express-checkout--locked')) showSizeError();
      });
    }

    function update(event) {
      var chosen = new Array(optionCount);
      selects.forEach(function (s) { chosen[+s.dataset.optionIndex] = s.value; });
      swatches.forEach(function (r) {
        if (r.checked) {
          chosen[+r.dataset.optionIndex] = r.value;
          if (swatchName) swatchName.textContent = r.value;
        }
      });

      // No size yet: follow the color for the photo and keep the price, but
      // leave the variant id empty so nothing can be bought.
      var waitingForSize = !!sizeSelect && !sizeSelect.value;
      if (express) {
        express.classList.toggle('express-checkout--locked', waitingForSize);
        // inert also keeps keyboard users from tabbing to a locked Shop Pay.
        var inner = express.querySelector('[data-express-inner]');
        if (inner) inner.inert = waitingForSize;
      }
      if (waitingForSize) {
        idInput.value = '';
        var sameColor = variants.find(function (v) {
          return v.options.every(function (opt, i) { return chosen[i] === '' || opt === chosen[i]; });
        });
        if (sameColor) {
          price.textContent = sameColor.price;
          if (mainImage && sameColor.image) {
            mainImage.removeAttribute('srcset');
            mainImage.src = sameColor.image;
            mainImage.alt = sameColor.image_alt || '';
          }
          if (mainImageLink && sameColor.image_full) mainImageLink.href = sameColor.image_full;
        }
        button.disabled = false;
        button.textContent = 'Add to cart';
        return;
      }
      if (sizeSelect) {
        sizeSelect.classList.remove('is-invalid');
        if (sizeError) sizeError.hidden = true;
      }

      var match = variants.find(function (v) {
        return v.options.every(function (opt, i) { return opt === chosen[i]; });
      });
      if (!match) {
        // This color/size combination doesn't exist (common with POD products).
        button.disabled = true;
        button.textContent = 'Unavailable';
        price.textContent = '';
        return;
      }
      idInput.value = match.id;
      price.textContent = match.price;
      if (mainImage && match.image) {
        mainImage.removeAttribute('srcset');
        mainImage.src = match.image;
        mainImage.alt = match.image_alt || '';
      }
      if (mainImageLink && match.image_full) mainImageLink.href = match.image_full;
      button.disabled = !match.available;
      button.textContent = match.available ? 'Add to cart' : 'Sold out';
      if (event) {
        var url = new URL(window.location.href);
        url.searchParams.set('variant', match.id);
        window.history.replaceState({}, '', url.toString());
      }
    }

    selects.forEach(function (s) { s.addEventListener('change', update); });
    swatches.forEach(function (r) { r.addEventListener('change', update); });
    // Sync the hidden id with whatever the controls show (e.g. restored form state).
    if (selects.length || swatches.length) update();
  });

  // Holiday order-by notes: hide one whose date has passed (the page may come
  // from Shopify's cache) and show the express note once the standard date is over.
  var today = (function () {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  })();
  document.querySelectorAll('[data-holiday-until]').forEach(function (note) {
    var after = note.getAttribute('data-holiday-after');
    var shown = today <= note.getAttribute('data-holiday-until') && (!after || today > after);
    note.hidden = !shown;
  });

  // Size chart dialog on the product page.
  var sizeChart = document.querySelector('[data-size-chart]');
  if (sizeChart && typeof sizeChart.showModal === 'function') {
    document.querySelectorAll('[data-size-chart-open]').forEach(function (button) {
      button.addEventListener('click', function () { sizeChart.showModal(); });
    });
    sizeChart.addEventListener('click', function (e) {
      if (e.target === sizeChart) sizeChart.close();
    });
  } else {
    document.querySelectorAll('[data-size-chart-open]').forEach(function (button) { button.hidden = true; });
  }

  // Lightbox for the main photo and the small design images (replaces Drupal's lightbox2).
  var dialog = document.querySelector('[data-lightbox-dialog]');
  if (dialog && typeof dialog.showModal === 'function') {
    var img = dialog.querySelector('[data-lightbox-image]');
    var prev = dialog.querySelector('[data-lightbox-prev]');
    var next = dialog.querySelector('[data-lightbox-next]');
    var links = Array.prototype.slice.call(document.querySelectorAll('[data-lightbox]'));
    var current = 0;

    // Show links[index], wrapping around at either end.
    function show(index) {
      current = (index + links.length) % links.length;
      var link = links[current];
      img.alt = (link.querySelector('img') || {}).alt || '';
      // Open once the image has loaded so the dialog never flashes empty
      // or shows the previously zoomed image at the wrong size.
      img.onload = img.onerror = function () {
        img.onload = img.onerror = null;
        if (!dialog.open) dialog.showModal();
      };
      img.src = link.href;
      if (img.complete && img.naturalWidth) img.onload();
    }

    links.forEach(function (link, i) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        show(i);
      });
    });

    // Previous/next only make sense with more than one image.
    var multiple = links.length > 1;
    prev.hidden = next.hidden = !multiple;
    prev.addEventListener('click', function () { show(current - 1); });
    next.addEventListener('click', function () { show(current + 1); });
    dialog.addEventListener('keydown', function (e) {
      if (!multiple) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(current - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(current + 1); }
    });

    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) dialog.close();
    });
  }
})();
