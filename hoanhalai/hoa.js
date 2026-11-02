(() => {
  const products = [
    {id:1,name:'Vườn hồng',price:480000,occasion:['Tặng người thương','Sinh nhật'],desc:'Hồng đỏ, cúc tana và lá bạc dịu dàng.',tag:'Được yêu thích',img:'photo-1525310072745-f49212b5ac6d'},
    {id:2,name:'Nắng đầu ngày',price:350000,occasion:['Sinh nhật','Cảm ơn'],desc:'Hướng dương và cúc nhỏ, tươi như lời chào.',tag:'Hoa theo mùa',img:'photo-1494972308805-463bc619d34e'},
    {id:3,name:'Một ngày dịu dàng',price:620000,occasion:['Tặng người thương','Sinh nhật'],desc:'Hồng garden hồng phấn, cắm dáng tự nhiên.',tag:'Bó đặc biệt',img:'photo-1520763185298-1b434c919102'},
    {id:4,name:'Màu trời tháng Tư',price:290000,occasion:['Cảm ơn','Chúc bình an'],desc:'Cẩm tú cầu xanh tím và những nhành hoa nhỏ.',tag:'Vừa túi xinh',img:'photo-1563241527-3004b7be0ffd'},
    {id:5,name:'Lời thương màu trắng',price:540000,occasion:['Chúc bình an','Tặng người thương'],desc:'Hồng trắng, baby và lá khuynh diệp.',tag:'Hoa theo mùa',img:'photo-1487530811176-3780de880c2d'},
    {id:6,name:'Cam lành',price:390000,occasion:['Sinh nhật','Cảm ơn'],desc:'Mao lương cam và đồng tiền vàng rực rỡ.',tag:'Được yêu thích',img:'photo-1494972308805-463bc619d34e'},
    {id:7,name:'Mây hồng',price:330000,occasion:['Sinh nhật','Tặng người thương'],desc:'Cẩm chướng hồng, hồng nhánh và lá thơm.',tag:'Hoa theo mùa',img:'photo-1490750967868-88aa4486c946'},
    {id:8,name:'Bó tulip nhỏ',price:260000,occasion:['Cảm ơn','Chúc bình an'],desc:'Tulip màu nắng gói giấy mộc, vừa xinh để tặng.',tag:'Vừa túi xinh',img:'photo-1523694576729-dc99e9c0f9e4'}
  ];
  const $ = (selector, root=document) => root.querySelector(selector);
  const money = value => new Intl.NumberFormat('vi-VN').format(value) + '₫';
  const photo = (id, width=760) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=82`;
  const filtersEl = $('#filters'), grid = $('#productGrid'), cartDrawer = $('#cartDrawer'), scrim = $('#scrim');
  let filter = 'Tất cả', sort = 'featured', cart = {}, toastTimer;
  const occasions = ['Tất cả', ...new Set(products.flatMap(product => product.occasion))];

  function renderFilters() {
    filtersEl.innerHTML = occasions.map(item => `<button class="filter-chip" type="button" aria-pressed="${item === filter}" data-filter="${item}">${item}</button>`).join('');
  }
  function visibleProducts() {
    let list = products.filter(product => filter === 'Tất cả' || product.occasion.includes(filter));
    if (sort === 'low') list = list.slice().sort((a,b) => a.price-b.price);
    if (sort === 'high') list = list.slice().sort((a,b) => b.price-a.price);
    return list;
  }
  function renderProducts() {
    grid.innerHTML = visibleProducts().map(product => `<article class="product-card">
      <div class="product-photo"><img src="${photo(product.img)}" alt="Bó hoa ${product.name}" loading="lazy"><span class="product-tag">${product.tag}</span><button class="favorite" type="button" aria-label="Lưu ${product.name}" aria-pressed="false">♡</button></div>
      <div class="product-info"><div class="product-title-row"><h3>${product.name}</h3><span class="price">${money(product.price)}</span></div><p>${product.desc}</p><div class="product-actions"><button class="add-button" type="button" data-add="${product.id}">Thêm vào giỏ <span aria-hidden="true">+</span></button><button class="details-button" type="button" data-ask="${product.id}">Hỏi Lài</button></div></div>
    </article>`).join('');
  }
  function showToast(message) {
    const toast = $('#toast'); toast.textContent = message; toast.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('on'), 2100);
  }
  function quantity() { return Object.values(cart).reduce((sum, count) => sum + count, 0); }
  function total() { return Object.entries(cart).reduce((sum, [id, count]) => sum + products.find(product => product.id === Number(id)).price * count, 0); }
  function renderCart() {
    const ids = Object.keys(cart);
    $('#cartCount').textContent = quantity(); $('#drawerCount').textContent = `(${quantity()})`;
    if (!ids.length) {
      $('#drawerBody').innerHTML = '<div class="empty-cart"><strong>Giỏ hoa còn trống.</strong><p>Chọn một bó hoa nhỏ để gửi đi điều bạn muốn nói.</p><a class="button button-dark" href="#shop" data-close>Chọn hoa <span>↗</span></a></div>';
      $('#drawerFoot').innerHTML = ''; return;
    }
    $('#drawerBody').innerHTML = ids.map(id => {
      const product = products.find(item => item.id === Number(id));
      return `<article class="cart-line"><img src="${photo(product.img,180)}" alt=""><div><h3>${product.name}</h3><small>${money(product.price)} / bó</small><div class="quantity"><button type="button" data-qty="-1" data-id="${id}" aria-label="Bớt một bó ${product.name}">−</button><span>${cart[id]}</span><button type="button" data-qty="1" data-id="${id}" aria-label="Thêm một bó ${product.name}">+</button><button class="remove-line" type="button" data-remove="${id}">Bỏ</button></div></div><span class="line-price">${money(product.price * cart[id])}</span></article>`;
    }).join('');
    const minDate = new Date(); minDate.setDate(minDate.getDate() + (new Date().getHours() >= 17 ? 1 : 0));
    const dateValue = `${minDate.getFullYear()}-${String(minDate.getMonth()+1).padStart(2,'0')}-${String(minDate.getDate()).padStart(2,'0')}`;
    $('#drawerFoot').innerHTML = `<form id="orderForm" novalidate>
      <label>Tên người nhận<input name="recipient" autocomplete="name" placeholder="Tên người nhận" required></label>
      <label>Số điện thoại<input name="phone" type="tel" autocomplete="tel" placeholder="09xx xxx xxx" pattern="[0-9+ .()-]{9,16}" required></label>
      <label class="wide">Địa chỉ giao hoa<input name="address" autocomplete="street-address" placeholder="Số nhà, đường, phường" required></label>
      <label>Ngày giao<input name="date" type="date" min="${dateValue}" value="${dateValue}" required></label>
      <label>Khung giờ<select name="time"><option>Buổi sáng · 08:00–12:00</option><option>Buổi chiều · 13:00–17:00</option><option>Buổi tối · 17:00–20:00</option></select></label>
      <label class="wide">Lời nhắn trên thiệp <small>(không bắt buộc)</small><textarea name="note" rows="2" maxlength="140" placeholder="Lài sẽ viết tay giúp bạn"></textarea></label>
      <p class="order-error" id="orderError" role="alert"></p><div class="total-row"><span>Tạm tính <small>· Phí giao sẽ xác nhận riêng</small></span><strong>${money(total())}</strong></div><button class="button button-dark" type="submit">Gửi yêu cầu đặt hoa <span>↗</span></button></form>`;
  }
  function openCart() { renderCart(); cartDrawer.classList.add('on'); scrim.classList.add('on'); cartDrawer.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; $('#closeCart').focus(); }
  function closeCart() { cartDrawer.classList.remove('on'); scrim.classList.remove('on'); cartDrawer.setAttribute('aria-hidden','true'); document.body.style.overflow=''; $('#openCart').focus(); }

  filtersEl.addEventListener('click', event => { const button = event.target.closest('[data-filter]'); if (!button) return; filter=button.dataset.filter; renderFilters(); renderProducts(); });
  $('#sort').addEventListener('change', event => { sort=event.target.value; renderProducts(); });
  grid.addEventListener('click', event => {
    const add = event.target.closest('[data-add]');
    if (add) { const id=Number(add.dataset.add); cart[id]=(cart[id]||0)+1; renderCart(); add.classList.add('added'); add.innerHTML='Đã thêm <span aria-hidden="true">✓</span>'; showToast(`${products.find(item=>item.id===id).name} đã được thêm vào giỏ`); setTimeout(()=>{ if(add.isConnected){add.classList.remove('added');add.innerHTML='Thêm vào giỏ <span aria-hidden="true">+</span>'; } },1300); return; }
    const favorite = event.target.closest('.favorite'); if (favorite) { const active=favorite.getAttribute('aria-pressed')==='true'; favorite.setAttribute('aria-pressed',String(!active)); favorite.textContent=active?'♡':'♥'; showToast(active?'Đã bỏ khỏi danh sách yêu thích':'Đã lưu bó hoa yêu thích'); return; }
    if (event.target.closest('[data-ask]')) { $('#contactMessage').value='Mình muốn hỏi thêm về bó hoa này: '+products.find(item=>item.id===Number(event.target.closest('[data-ask]').dataset.ask)).name; location.hash='#contact'; }
  });
  $('#openCart').addEventListener('click',openCart); $('#closeCart').addEventListener('click',closeCart); scrim.addEventListener('click',closeCart);
  $('#drawerBody').addEventListener('click',event=>{const qty=event.target.closest('[data-qty]');const remove=event.target.closest('[data-remove]');if(qty){const id=qty.dataset.id;cart[id]+=Number(qty.dataset.qty);if(cart[id]<=0)delete cart[id];renderCart();}if(remove){delete cart[remove.dataset.remove];renderCart();}});
  $('#drawerBody').addEventListener('click',event=>{if(event.target.closest('[data-close]'))closeCart();});
  $('#drawerFoot').addEventListener('submit',event=>{if(event.target.id!=='orderForm')return;event.preventDefault();const form=event.target;if(!form.reportValidity())return;const recipient=form.elements.recipient.value.trim().replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));cart={};$('#cartCount').textContent='0';$('#drawerCount').textContent='(0)';$('#drawerFoot').innerHTML='';$('#drawerBody').innerHTML=`<div class="success-state"><span>✿</span><h3>Lài nhận được lời nhắn rồi!</h3><p>Cảm ơn bạn. Lài sẽ gọi xác nhận bó hoa gửi đến <strong>${recipient}</strong>, địa chỉ và phí giao trước khi chuẩn bị hoa.</p><button type="button" class="button button-dark" data-finish>Tiếp tục xem hoa <span>↗</span></button></div>`;$('#drawerBody').querySelector('[data-finish]').addEventListener('click',closeCart);});
  $('#contactForm').addEventListener('submit',event=>{event.preventDefault();if(!event.currentTarget.reportValidity())return;$('#contactStatus').textContent='Lài nhận được lời nhắn rồi, sẽ liên hệ bạn sớm nha.';event.currentTarget.reset();});
  $('#newsletterForm').addEventListener('submit',event=>{event.preventDefault();if(!event.currentTarget.reportValidity())return;$('#newsletterStatus').textContent='Cảm ơn bạn, hẹn gặp trong hộp thư nhé.';event.currentTarget.reset();});
  $('#menuToggle').addEventListener('click',event=>{const nav=$('#mainNav'),open=nav.classList.toggle('open');event.currentTarget.setAttribute('aria-expanded',String(open));event.currentTarget.setAttribute('aria-label',open?'Đóng menu':'Mở menu');});
  $('#mainNav').addEventListener('click',event=>{if(event.target.closest('a')){$('#mainNav').classList.remove('open');$('#menuToggle').setAttribute('aria-expanded','false');}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(cartDrawer.classList.contains('on'))closeCart();$('#mainNav').classList.remove('open');$('#menuToggle').setAttribute('aria-expanded','false');}});
  renderFilters();renderProducts();renderCart();
})();
