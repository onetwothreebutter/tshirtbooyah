/* Tshirt Booyah theme: variant picker, color swatches, size chart and image lightbox. No dependencies. */
(function () {
  function capture(event, properties) {
    if (window.posthog && typeof window.posthog.capture === 'function') {
      window.posthog.capture(event, properties);
    }
  }

  function log(message, attributes) {
    if (window.posthog && window.posthog.logger && typeof window.posthog.logger.info === 'function') {
      window.posthog.logger.info(message, attributes);
    }
  }

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

    function update(event) {
      var chosen = new Array(optionCount);
      selects.forEach(function (s) { chosen[+s.dataset.optionIndex] = s.value; });
      swatches.forEach(function (r) {
        if (r.checked) {
          chosen[+r.dataset.optionIndex] = r.value;
          if (swatchName) swatchName.textContent = r.value;
        }
      });
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
        var variantSelection = {
          product_id: form.dataset.productId,
          variant_id: String(match.id),
          variant_available: match.available
        };
        capture('product_variant_selected', variantSelection);
        log('product_variant_selected', variantSelection);
      }
    }

    selects.forEach(function (s) { s.addEventListener('change', update); });
    swatches.forEach(function (r) { r.addEventListener('change', update); });
    form.addEventListener('submit', function () {
      if (!button.disabled) {
        var cartAddition = {
          product_id: form.dataset.productId,
          variant_id: idInput.value
        };
        capture('product_added_to_cart', cartAddition);
        log('product_added_to_cart', cartAddition);
      }
    });
    // Sync the hidden id with whatever the controls show (e.g. restored form state).
    if (selects.length || swatches.length) update();
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

  document.querySelectorAll('[data-cart-form]').forEach(function (form) {
    form.querySelectorAll('[data-cart-action]').forEach(function (button) {
      button.addEventListener('click', function () {
        var cartAction = {
          cart_item_count: Number(form.dataset.cartItemCount),
          cart_total_cents: Number(form.dataset.cartTotalCents),
          currency: form.dataset.currency
        };
        if (button.dataset.cartAction === 'cart_updated') {
          capture('cart_updated', cartAction);
          log('cart_updated', cartAction);
        } else if (button.dataset.cartAction === 'checkout_started') {
          capture('checkout_started', cartAction);
          log('checkout_started', cartAction);
        }
      });
    });
  });

  document.querySelectorAll('[data-search-form]').forEach(function (form) {
    form.addEventListener('submit', function () {
      var query = form.querySelector('[name="q"]');
      capture('search_submitted', {
        query_length: query ? query.value.trim().length : 0
      });
    });
  });

  document.querySelectorAll('[data-contact-form]').forEach(function (form) {
    form.addEventListener('submit', function () {
      capture('contact_form_submitted', {
        form_location: 'contact_page'
      });
    });
  });
})();
