/* Tshirt Booyah theme: variant picker and image lightbox. No dependencies. */
(function () {
  // Product page: map the option dropdowns to a variant id.
  document.querySelectorAll('[data-product-form]').forEach(function (form) {
    var root = form.closest('#details_infobox');
    var json = root && root.querySelector('[data-variants]');
    if (!json) return;
    var variants = JSON.parse(json.textContent);
    var selects = form.querySelectorAll('select[data-option-index]');
    var idInput = form.querySelector('[data-variant-id]');
    var button = form.querySelector('[data-add-button]');
    var price = root.querySelector('[data-price]');
    var mainImage = document.querySelector('[data-main-image]');

    function update(event) {
      var chosen = Array.prototype.map.call(selects, function (s) { return s.value; });
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
      button.disabled = !match.available;
      button.textContent = match.available ? 'Add to cart' : 'Sold out';
      if (event) {
        var url = new URL(window.location.href);
        url.searchParams.set('variant', match.id);
        window.history.replaceState({}, '', url.toString());
      }
    }

    selects.forEach(function (s) { s.addEventListener('change', update); });
    // Sync the hidden id with whatever the dropdowns show (e.g. restored form state).
    if (selects.length) update();
  });

  // Lightbox for the small design images (replaces Drupal's lightbox2).
  var dialog = document.querySelector('[data-lightbox-dialog]');
  if (dialog && typeof dialog.showModal === 'function') {
    var img = dialog.querySelector('[data-lightbox-image]');
    document.querySelectorAll('[data-lightbox]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        img.src = link.href;
        img.alt = (link.querySelector('img') || {}).alt || '';
        dialog.showModal();
      });
    });
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) dialog.close();
    });
  }
})();
