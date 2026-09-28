document.addEventListener('DOMContentLoaded', function(){

  // Mobile nav toggle
  var navToggle = document.getElementById('navToggle');
  var links = document.querySelector('.navlinks');
  if(navToggle){
    navToggle.addEventListener('click', function(){
      var open = links.style.display === 'flex';
      links.style.display = open ? 'none' : 'flex';
      links.style.flexDirection = 'column';
      links.style.position = 'absolute';
      links.style.top = '54px';
      links.style.left = '0';
      links.style.right = '0';
      links.style.background = 'var(--white)';
      links.style.borderBottom = '1px solid var(--border)';
      links.style.padding = '16px 32px';
      links.style.gap = '6px';
      navToggle.setAttribute('aria-expanded', String(!open));
    });
  }

  // Overlay + modal + drawer
  var overlay = document.getElementById('overlay');
  var accountModal = document.getElementById('accountModal');
  var cartDrawer = document.getElementById('cartDrawer');

  function closeAll(){
    if(accountModal) accountModal.classList.remove('open');
    if(cartDrawer) cartDrawer.classList.remove('open');
    if(overlay) overlay.classList.remove('open');
  }
  if(overlay) overlay.addEventListener('click', closeAll);
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeAll(); });

  function openAccount(e){
    if(e) e.preventDefault();
    closeAll();
    if(accountModal){ accountModal.classList.add('open'); overlay.classList.add('open'); }
    var lemail = document.getElementById('lemail');
    if(lemail) lemail.focus();
  }
  var accountBtn = document.getElementById('accountBtn');
  var signInLink = document.getElementById('signInLink');
  if(accountBtn) accountBtn.addEventListener('click', openAccount);
  if(signInLink) signInLink.addEventListener('click', openAccount);
  var closeAccount = document.getElementById('closeAccount');
  if(closeAccount) closeAccount.addEventListener('click', closeAll);

  var cartBtn = document.getElementById('cartBtn');
  if(cartBtn) cartBtn.addEventListener('click', function(){
    closeAll(); cartDrawer.classList.add('open'); overlay.classList.add('open');
  });
  var closeCart = document.getElementById('closeCart');
  if(closeCart) closeCart.addEventListener('click', closeAll);

  // Auth tabs
  var tabLogin = document.getElementById('tabLogin');
  var tabRegister = document.getElementById('tabRegister');
  var loginForm = document.getElementById('loginForm');
  var registerForm = document.getElementById('registerForm');
  if(tabLogin && tabRegister){
    tabLogin.addEventListener('click', function(){
      tabLogin.classList.add('active'); tabRegister.classList.remove('active');
      loginForm.classList.add('active'); registerForm.classList.remove('active');
    });
    tabRegister.addEventListener('click', function(){
      tabRegister.classList.add('active'); tabLogin.classList.remove('active');
      registerForm.classList.add('active'); loginForm.classList.remove('active');
    });
    loginForm.addEventListener('submit', function(e){
      e.preventDefault();
      document.getElementById('loginMsg').classList.add('show');
    });
    registerForm.addEventListener('submit', function(e){
      e.preventDefault();
      document.getElementById('registerMsg').classList.add('show');
    });
  }

  // Contact form
  var contactForm = document.getElementById('contactForm');
  if(contactForm){
    contactForm.addEventListener('submit', function(e){
      e.preventDefault();
      document.getElementById('contactMsg').classList.add('show');
    });
  }

  // Cart logic (in-memory, per page load)
  var cart = [];
  var cartItemsEl = document.getElementById('cartItems');
  var cartBadge = document.getElementById('cartBadge');
  var cartSubtotal = document.getElementById('cartSubtotal');

  function renderCart(){
    if(!cartItemsEl) return;
    if(cart.length === 0){
      cartItemsEl.innerHTML = '<p class="cart-empty">Your bag is empty.</p>';
    } else {
      cartItemsEl.innerHTML = cart.map(function(item, i){
        return '<div class="cart-item"><div><h4>'+item.name+'</h4><span>$'+item.price+'</span>' +
          '<div class="qtyrow"><button data-i="'+i+'" data-d="-1" class="qtybtn">-</button><span>'+item.qty+'</span>' +
          '<button data-i="'+i+'" data-d="1" class="qtybtn">+</button></div>' +
          '<button class="remove" data-i="'+i+'">Remove</button></div>' +
          '<strong>$'+(item.price*item.qty)+'</strong></div>';
      }).join('');
    }
    var count = cart.reduce(function(s,i){return s+i.qty;},0);
    if(cartBadge){ cartBadge.textContent = count; cartBadge.hidden = count === 0; }
    if(cartSubtotal){
      var subtotal = cart.reduce(function(s,i){return s+i.price*i.qty;},0);
      cartSubtotal.textContent = '$'+subtotal;
    }
  }

  document.querySelectorAll('.addcart').forEach(function(btn){
    btn.addEventListener('click', function(){
      var name = btn.getAttribute('data-name');
      var price = parseFloat(btn.getAttribute('data-price'));
      var existing = cart.find(function(i){return i.name === name;});
      if(existing){ existing.qty++; } else { cart.push({name:name, price:price, qty:1}); }
      renderCart();
      var prev = btn.textContent;
      btn.textContent = 'Added';
      setTimeout(function(){ btn.textContent = prev; }, 900);
    });
  });

  if(cartItemsEl){
    cartItemsEl.addEventListener('click', function(e){
      var t = e.target;
      if(t.classList.contains('qtybtn')){
        var i = parseInt(t.getAttribute('data-i'));
        var d = parseInt(t.getAttribute('data-d'));
        cart[i].qty += d;
        if(cart[i].qty <= 0) cart.splice(i,1);
        renderCart();
      } else if(t.classList.contains('remove')){
        var idx = parseInt(t.getAttribute('data-i'));
        cart.splice(idx,1);
        renderCart();
      }
    });
  }

  var checkoutBtn = document.getElementById('checkoutBtn');
  if(checkoutBtn){
    checkoutBtn.addEventListener('click', function(){
      if(cart.length === 0) return;
      cart = [];
      renderCart();
      closeAll();
    });
  }

  // Notify-me buttons on the Upcoming page
  document.querySelectorAll('.notifybtn').forEach(function(btn){
    btn.addEventListener('click', function(){
      btn.textContent = "You're on the list";
      btn.classList.add('done');
      btn.disabled = true;
    });
  });

});
