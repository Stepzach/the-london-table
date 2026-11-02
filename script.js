/* THE LONDON TABLE — published restaurant reviews. See README for adding a real review. */
const CONTENT = {
 profile:{username:'zachary.stephens',displayName:'London Restaurants',avatarUrl:'https://ik.imagekit.io/53bnrahwc/676B5659-B262-434D-B7FD-0424164BEDD2_1_105_c.jpeg'},
 highlights:[{id:'all',name:'All spots',icon:'✳',color:'#f4e6d8'},
             
             
             {
  id: 'mexican',
  name: 'Mexican',
  icon: '🌮',
  color: '#f4e6d8'
},
{
  id: 'japanese',
  name: 'Japanese',
  icon: '🍣',
  color: '#e9e6d9'
},
             
             {id:'italian',name:'Italian',icon:'🍝',color:'#e9e6d9'},{id:'brunch',name:'Brunch',icon:'☕',color:'#eee1cd'},{id:'asian',name:'Asian',icon:'🍜',color:'#e9dfd8'},{id:'date-night',name:'Date night',icon:'♡',color:'#f0ddda'},{id:'budget',name:'Under £20',icon:'£',color:'#e0e9de'}],

posts: [
  {
    id: 'restaurant-001',

    // RESTAURANT INFORMATION
    name: 'Los Mochis',
    foodType: 'Mexican-Japanese',
    priceRange: '££',
    location: 'Notting Hill, London',
    nearestTube: 'Notting Hill Gate',

    // YOUR REVIEW
    rating: 4.7,
    description: `Mexican-Japanese Fusion Restaurant in Notting hill. 
    
    (Un)arguably the two best cuisines combined, its difficult to get this wrong. 
    
    High quality food with attention to detail. Nice intimate atmosphere but with slightly questionable decoration, still a great date spot. 
    
    Not cheap, but for the quality it’s totally justified. 
`,

    // CATEGORY & HIGHLIGHTS
    category: 'mexican',
tags: ['japanese', 'date-night'],

    // POST DATE (YYYY-MM-DD)
    date: '2026-10-25',

    // RESTAURANT WEBSITE
    websiteUrl: 'https://www.losmochis.co.uk/home',

    // GOOGLE MAPS IFRAME SOURCE
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2483.255593982353!2d-0.19969552337986812!3d51.50852667181395!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x48760f5b2b3c6ff7%3A0xe74911fd4ec778c3!2sLos%20Mochis%20Notting%20Hill!5e0!3m2!1sen!2suk!4v1793629768503!5m2!1sen!2suk',

    // IMAGE CAROUSEL (3 IMAGES)
    images: [
      {
        url: 'https://ik.imagekit.io/53bnrahwc/22_Mar_Los_Mochis_HR_+106.jpg',
        alt: 'Restaurant exterior or interior'
      },
      {
        url: 'https://ik.imagekit.io/53bnrahwc/IMG_8092.jpg',
        alt: 'Food ordered at the restaurant'
      },
      {
        url: 'https://ik.imagekit.io/53bnrahwc/IMG_8086.jpg',
        alt: 'The Menu'
      }
     
    ]
  }
]

};

// Shared, read-only restaurant data for the independent map view.
window.LONDON_TABLE_CONTENT = CONTENT;

(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const icon = (id) => `<svg aria-hidden="true"><use href="#i-${id}"></use></svg>`;
  const postList = CONTENT.posts;
  // Always provide three image slots when a newly added post omits photos.
  for (const post of postList) {
    if (!Array.isArray(post.images)) post.images = [];
    while (post.images.length < 3) post.images.push({ url: '', alt: '' });
  }
  // Only IDs currently in CONTENT.posts are included in the profile like total.
  const likeTotals = new Map();
  const likeVersions = new Map();
  let likeRefreshToken = 0;
  let lastRefreshAt = 0;
  let likeCountError = false;
  const labels = ['RESTAURANT', 'FOOD', 'MENU'];
  const savedKey = 'the-london-table-bookmarks-v1';
  let activeTab = 'posts';
  let activeFilter = 'all';
  let openIndex = -1;
  let photoIndex = 0;
  let currentLikes = [];
  let currentComments = [];
  let service = null;
  let serviceMode = 'unconfigured';
  let unsubscribe = () => {};
  let lastFocused = null;
  let busyLike = false;
  let busyComment = false;
  let toastTimeout;
  const safeRead = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const safeWrite = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private-mode storage unavailable. */ } };
  let bookmarks = new Set(safeRead(savedKey, []));
  const getPost = () => postList[openIndex];
  const dateLabel = (value) => new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
  const countLabel = (n, singular) => `${n.toLocaleString('en-GB')} ${singular}${n === 1 ? '' : 's'}`;
  const goodUrl = (url) => { try { const u = new URL(url); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
  const mapSearch = (post) => `https://www.google.com/maps?q=${encodeURIComponent(post.location + ', UK')}`;
  const mapEmbed = (post) => goodUrl(post.mapEmbedUrl) || `${mapSearch(post)}&output=embed`;
  const make = (tag, cls, text) => { const element = document.createElement(tag); if (cls) element.className = cls; if (text !== undefined) element.textContent = text; return element; };
  const shortId = (post) => String(postList.indexOf(post) + 1).padStart(2, '0');

  function toast(message) {
    const el = $('toast'); el.textContent = message; el.classList.add('is-visible');
    clearTimeout(toastTimeout); toastTimeout = setTimeout(() => el.classList.remove('is-visible'), 3100);
  }

  function unavailableImage() {const x=make('div','media-fallback');x.innerHTML=icon('camera');x.append(make('span','','Photo unavailable'));return x;}

  function imageSlot(post, kind, grid = false) {
    const photo = post.images?.[kind] || { url: '', alt: '' };
    const src = goodUrl(grid ? (photo.thumbnail || photo.url) : photo.url);
    if (!src) return unavailableImage();
    const img = make('img');
    img.alt = photo.alt || `${post.name}, ${labels[kind].toLowerCase()} photograph`;
    img.loading = grid ? 'lazy' : 'eager';
    img.decoding = 'async';
    img.src = src;
    // Broken remote photos become a deliberate, editable placeholder.
    img.addEventListener('error', () => img.replaceWith(unavailableImage()), { once: true });
    return img;
  }

  function renderProfileAvatars() {
    const url = goodUrl(CONTENT.profile.avatarUrl);
    for (const image of document.querySelectorAll('[data-profile-avatar]')) {
      const wrapper = image.parentElement;
      if (!url) {
        image.hidden = true;
        image.removeAttribute('src');
        wrapper.classList.remove('has-photo');
        continue;
      }
      image.onload = () => { image.hidden = false; wrapper.classList.add('has-photo'); };
      image.onerror = () => {
        image.hidden = true;
        wrapper.classList.remove('has-photo');
        console.warn('Profile image could not load. Check CONTENT.profile.avatarUrl.');
      };
      image.src = url;
    }
  }

  function updateProfileStats() {
    $('stat-posts').textContent = postList.length.toLocaleString('en-GB');
    const complete = postList.every(post => likeTotals.has(post.id));
    const likes = postList.reduce((sum, post) => sum + (likeTotals.get(post.id) || 0), 0);
    const label = complete ? likes.toLocaleString('en-GB') : (serviceMode === 'error' || serviceMode === 'unconfigured' || likeCountError) ? '—' : '…';
    $('stat-likes').textContent = label;
    $('stat-likes').title = complete
      ? `${countLabel(likes, 'like')} across ${countLabel(postList.length, 'post')}`
      : (serviceMode === 'error' || likeCountError) ? 'Could not load some like counts' : 'Loading total likes';
  }

  // Firestore count() aggregation avoids downloading every like on the whole profile.
  // Like counts refresh at startup, when a post changes, and on returning to the tab.
  async function refreshLikeTotals() {
    if (!service) return;
    const backend = service;
    const token = ++likeRefreshToken;
    const versions = new Map(likeVersions);
    const results = await Promise.allSettled(postList.map(async post => [post.id, await backend.getLikeCount(post.id)]));
    if (backend !== service || token !== likeRefreshToken) return;
    let errors = 0;
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const [id, count] = result.value;
        // A live post listener may have provided a more recent count meanwhile.
        if ((likeVersions.get(id) || 0) === (versions.get(id) || 0)) likeTotals.set(id, count);
      } else {
        errors++;
        console.error('Failed to fetch a restaurant like count:', result.reason);
      }
    }
    likeCountError = errors > 0;
    if (errors) console.warn(`Could not refresh ${errors} restaurant like count(s).`);
    lastRefreshAt = Date.now();
    updateProfileStats();
  }

  function renderHighlights() {
    const container = $('highlights'); container.replaceChildren();
    const categories = new Set(postList.flatMap(p=>[p.category,...(p.tags||[])]));
    document.querySelector('.explore-section').hidden = !postList.length;
    for (const filter of CONTENT.highlights.filter(h=>h.id==='all'||categories.has(h.id))) {
      const b = make('button', 'highlight' + (activeFilter === filter.id ? ' is-active' : ''));
      b.type = 'button'; b.setAttribute('aria-label', `Filter reviews: ${filter.name}`);
      b.setAttribute('aria-pressed', String(activeFilter === filter.id));
      const ring = make('span', 'highlight-ring');
      const inner = make('span', 'highlight-inner', filter.icon);
      inner.style.setProperty('--highlight-color', filter.color);
      ring.append(inner); b.append(ring, make('span', 'highlight-name', filter.name));
      b.addEventListener('click', () => { activeFilter = filter.id; activeTab = 'posts'; renderAll(); $('feed').scrollIntoView({ behavior:'smooth',block:'start' }); });
      container.append(b);
    }
  }

  function renderGrid() {
    const container = $('post-grid'); container.replaceChildren();
    let items = postList;
    if (activeTab === 'saved') items = items.filter(p => bookmarks.has(p.id));
    else if (activeFilter !== 'all') items = items.filter(p => p.category === activeFilter || p.tags?.includes(activeFilter));
    $('feed-count').textContent = countLabel(items.length, 'post');
    $('tab-posts').classList.toggle('is-active', activeTab === 'posts');
    $('tab-saved').classList.toggle('is-active', activeTab === 'saved');
    $('tab-posts').setAttribute('aria-selected', String(activeTab === 'posts'));
    $('tab-saved').setAttribute('aria-selected', String(activeTab === 'saved'));
    const filterBanner = $('active-filter');
    filterBanner.hidden = activeFilter === 'all' || activeTab === 'saved';
    if (!filterBanner.hidden) {
      const selected = CONTENT.highlights.find(h => h.id === activeFilter);
      filterBanner.replaceChildren(document.createTextNode(`Showing ${selected?.name || 'filtered'} restaurants`));
      const clear = make('button', '', 'Show all ×'); clear.type = 'button';
      clear.addEventListener('click', () => { activeFilter = 'all'; renderAll(); }); filterBanner.append(clear);
    }
    for (const post of items) {
      const button = make('button', 'grid-post'); button.type = 'button';
      button.setAttribute('aria-label', `Open review of ${post.name}, ${post.location}`);
      button.append(imageSlot(post, 0, true));
      const stack = make('span', 'grid-stack'); stack.innerHTML = icon('stack'); button.append(stack);
      const overlay = make('span', 'grid-overlay'); overlay.append(make('strong', '', post.name), make('span', '', `${post.foodType} · ${post.rating}/5`)); button.append(overlay);
      button.addEventListener('click', () => openPost(postList.indexOf(post)));
      container.append(button);
    }
    if (!items.length) {
      const box = make('div', 'empty-grid');
      const firstLaunch = activeTab==='posts' && activeFilter==='all' && postList.length===0;
      box.append(make('strong', '',firstLaunch?'Restaurant reviews coming soon.':activeTab==='saved'?'No saved restaurants yet.':'No reviews in this category.'),make('p','',firstLaunch?'Real London restaurant reviews will appear here as they are published.':activeTab==='saved'?'Save a review to find it here later.':'Browse all restaurants to see more places.'));
      if(!firstLaunch){const btn=make('button','','Browse all restaurants');btn.addEventListener('click',()=>{activeTab='posts';activeFilter='all';renderAll();});box.append(btn);}container.append(box);
    }
  }

  function renderAll() { updateProfileStats(); renderHighlights(); renderGrid(); updateNavActive(); }
  function updateNavActive() {
    for (const b of document.querySelectorAll('[data-nav]')) b.classList.toggle('is-active', b.dataset.nav === (activeTab === 'saved' ? 'saved' : 'posts'));
  }
  function setTab(name) { activeTab = name; if (name === 'posts') activeFilter = 'all'; renderAll(); $('feed').scrollIntoView({behavior:'smooth',block:'start'}); }

  function openPost(index, withHash = true) {
    if (index < 0 || index >= postList.length) return;
    const dialog = $('post-dialog');
    if (!dialog.open) { lastFocused = document.activeElement; dialog.showModal(); document.body.style.overflow = 'hidden'; }
    openIndex = index; photoIndex = 0;
    renderPost();
    if (withHash) history.replaceState(null, '', `#post/${encodeURIComponent(getPost().id)}`);
    subscribeCurrent();
  }
  function closePost() { if ($('post-dialog').open) $('post-dialog').close(); }
  function renderPost() {
    const post = getPost(); if (!post) return;
    $('post-dialog').setAttribute('aria-label', `${post.name} review, ${openIndex + 1} of ${postList.length}`);
    $('post-author-location').textContent = post.location;
    $('post-date').textContent = dateLabel(post.date).toUpperCase();
    $('previous-post').hidden = openIndex === 0;
    $('next-post').hidden = openIndex === postList.length - 1;
    $('save-button').classList.toggle('is-saved', bookmarks.has(post.id));
    $('save-button').setAttribute('aria-pressed', String(bookmarks.has(post.id)));
    $('save-button').setAttribute('aria-label', bookmarks.has(post.id) ? 'Remove saved restaurant' : 'Save restaurant');
    const caption = $('post-caption'); caption.replaceChildren();
   
    const title = make('div','caption-title-line');
    const h2 = make('h2','',post.name); const rating = make('span','rating-chip');
    rating.append(make('span','','★'),document.createTextNode(`${post.rating.toFixed(1)} / 5`)); title.append(h2,rating); caption.append(title);
    caption.append(make('div','caption-type',post.foodType));
    const strip = make('div','info-strip');
    const detailRows = [['CUISINE',post.foodType,''],['PRICE RANGE',post.priceRange,''],['NEIGHBOURHOOD',post.location,'pin'],['NEAREST TUBE',post.nearestTube,'train']];
    for (const [key,value,glyph] of detailRows) { const cell = make('div','info-cell'); cell.append(make('label','',key)); const span = make('span'); if (glyph) span.innerHTML = icon(glyph); span.append(document.createTextNode(value)); cell.append(span); strip.append(cell); }
    caption.append(strip,make('strong','review-label','My review'),make('p','review-copy',post.description));
    const site = goodUrl(post.websiteUrl);
    if(site){const link=make('a','post-visit-link','Restaurant website');link.href=site;link.target='_blank';link.rel='noopener noreferrer';caption.append(link);}
    const mapRow = make('div','map-label-row');mapRow.append(make('strong','','Find it in London'));
    const mapLink = make('a','', 'Open in Google Maps');mapLink.href=mapSearch(post);mapLink.target='_blank';mapLink.rel='noopener noreferrer';mapRow.append(mapLink);caption.append(mapRow);
    const mapFrame = make('div','post-map-frame'); const map = make('iframe');map.loading='lazy';map.title=`Map of ${post.location}`;map.referrerPolicy='no-referrer-when-downgrade';map.src=mapEmbed(post);mapFrame.append(map);caption.append(mapFrame);
    $('post-scroll').scrollTop = 0;
    currentLikes = []; currentComments = []; updateSocial();
    $('social-status').textContent = serviceMode==='unconfigured'?'Likes and comments will be available once Firebase is connected.':serviceMode==='firebase'?'Loading live reactions…':'Connecting reactions…';
    renderPhoto();
  }
  function renderPhoto() {
    const post = getPost(); if (!post) return;
    $('post-image-slot').replaceChildren(imageSlot(post, photoIndex));
    $('media-type').textContent = labels[photoIndex];
    $('photo-counter').textContent = `${photoIndex + 1} / ${post.images.length}`;
    $('previous-photo').hidden = photoIndex === 0;
    $('next-photo').hidden = photoIndex === post.images.length - 1;
    const dots = $('carousel-dots'); dots.replaceChildren();
    post.images.forEach((_,idx) => { const dot = make('button','carousel-dot'+(idx===photoIndex?' is-active':''));dot.type='button';dot.setAttribute('aria-label',`Show ${labels[idx].toLowerCase()} photo`);dot.setAttribute('aria-current',String(idx===photoIndex));dot.addEventListener('click',()=>{photoIndex=idx;renderPhoto();});dots.append(dot); });
  }
  function movePhoto(direction) {
    const next=photoIndex+direction;
    if(next>=0&&next<getPost().images.length){photoIndex=next;renderPhoto();}
    else movePost(direction);
  }
  function movePost(direction) {
    const next=openIndex+direction;
    if(next>=0&&next<postList.length)openPost(next);
  }

  function updateSocial() {
    const liked = !!(service && currentLikes.includes(service.uid));
    $('likes-count').textContent = countLabel(currentLikes.length,'like');
    $('comments-count').textContent = countLabel(currentComments.length,'comment');
    $('comments-title-count').textContent = `(${currentComments.length})`;
    $('like-button').disabled=!service || busyLike;
    $('submit-comment').disabled=!service || busyComment;
    $('like-button').classList.toggle('is-liked',liked);
    $('like-button').setAttribute('aria-pressed',String(liked));
    $('like-button').setAttribute('aria-label',liked?'Unlike restaurant':'Like restaurant');
    const list=$('comments-list');list.replaceChildren();
    if (!currentComments.length) { list.append(make('p','comments-empty','Be the first to leave a note.'));return; }
    const sorted=[...currentComments].sort((a,b)=>(b.createdAt?.toMillis?.()||b.createdAt||0)-(a.createdAt?.toMillis?.()||a.createdAt||0));
    for(const comment of sorted){
      const row=make('div','comment-item');
      const avatar=make('span','comment-avatar',(comment.author||'?').trim().charAt(0).toUpperCase());
      const content=make('div','comment-content');content.append(make('strong','',comment.author),make('span','',comment.text));
      const when=comment.createdAt?.toDate?.()||new Date(comment.createdAt||Date.now());
      content.append(make('small','',when.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})));
      row.append(avatar,content);
      if(service&&comment.uid===service.uid){const remove=make('button','comment-delete','Delete');remove.type='button';remove.setAttribute('aria-label',`Delete comment by ${comment.author}`);remove.addEventListener('click',async()=>{remove.disabled=true;try{await service.removeComment(getPost().id,comment.id);toast('Comment deleted');}catch(e){toast('Could not delete comment');remove.disabled=false;}});row.append(remove);}
      list.append(row);
    }
  }

  function subscribeCurrent() {
    unsubscribe(); unsubscribe=()=>{};
    const post=getPost(); if(!post||!service)return;
    let selectedPostId=post.id;
    unsubscribe=service.subscribe(post.id, ({likes,comments})=>{
      if(!getPost()||getPost().id!==selectedPostId)return;
      currentLikes=likes;currentComments=comments;updateSocial();
      likeTotals.set(selectedPostId, likes.length);
      likeVersions.set(selectedPostId, (likeVersions.get(selectedPostId) || 0) + 1);
      updateProfileStats();
      $('social-status').textContent='';
    }, (error)=>{$('social-status').textContent='Could not load reactions. Check Firebase permissions and configuration.';console.error('Subscription error',error);});
  }

  async function connectFirebase() {
    const config=window.FIREBASE_CONFIG;
    const configured=config && !String(config.apiKey||'').includes('PASTE_') && !String(config.projectId||'').includes('PASTE_') && !!config.apiKey && !!config.projectId && !!config.appId;
    if(!configured){serviceMode='unconfigured';updateProfileStats();updateSocial();return;}
    try{
      // Pinned modular Firebase SDK. Uses free Spark-plan Auth + Firestore; no backend required.
      const [appSDK,authSDK,dbSDK]=await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js')
      ]);
      const app=appSDK.initializeApp(config),auth=authSDK.getAuth(app),db=dbSDK.getFirestore(app);
      const credentials=await authSDK.signInAnonymously(auth);
      const uid=credentials.user.uid;
      service={
        uid,
        async getLikeCount(id){
          const result=await dbSDK.getCountFromServer(dbSDK.collection(db,'posts',id,'likes'));
          return result.data().count;
        },
        subscribe(id,cb,onError){
          let likes=[],comments=[];
          const notify=()=>cb({likes,comments});
          // Only the OPEN post is watched; all active listeners are removed on close.
          // This provides accurate, live counts without Cloud Functions or paid billing.
          const unLikes=dbSDK.onSnapshot(dbSDK.collection(db,'posts',id,'likes'),snapshot=>{likes=snapshot.docs.map(d=>d.id);notify();},onError);
          const unComments=dbSDK.onSnapshot(dbSDK.collection(db,'posts',id,'comments'),snapshot=>{comments=snapshot.docs.map(d=>({id:d.id,...d.data()}));notify();},onError);
          return()=>{unLikes();unComments();};
        },
        async toggleLike(id,shouldLike){
          const ref=dbSDK.doc(db,'posts',id,'likes',uid);
          if(shouldLike)await dbSDK.setDoc(ref,{createdAt:dbSDK.serverTimestamp()});
          else await dbSDK.deleteDoc(ref);
        },
        async addComment(id,author,text){await dbSDK.addDoc(dbSDK.collection(db,'posts',id,'comments'),{uid,author,text,createdAt:dbSDK.serverTimestamp()});},
        async removeComment(id,commentId){await dbSDK.deleteDoc(dbSDK.doc(db,'posts',id,'comments',commentId));}
      };
      serviceMode='firebase';subscribeCurrent();refreshLikeTotals();
    }catch(error){
      serviceMode='error';updateProfileStats();updateSocial();console.error('Firebase could not connect:',error);
      $('social-status').textContent='Firebase is not connected. Check config, Anonymous Authentication and Firestore rules.';
      toast('Firebase connection needs attention. See README.md');
    }
  }

  $('post-dialog').addEventListener('close',()=>{
    unsubscribe();unsubscribe=()=>{};openIndex=-1;document.body.style.overflow='';
    // Keep profile totals up to date without a permanent full-feed listener.
    if (serviceMode === 'firebase') refreshLikeTotals();
    if(location.hash.startsWith('#post/')){
      const unlinkedUrl=location.href.split('#')[0];
      try{history.replaceState(null,'',unlinkedUrl);}catch{ /* Opaque preview origins may not support history changes. */ }
    }
    lastFocused?.focus?.({preventScroll:true});
  });
  $('close-post').addEventListener('click',closePost);
  $('post-overlay').addEventListener('click',(event)=>{if(event.target===$('post-overlay'))closePost();});
  $('previous-photo').addEventListener('click',()=>movePhoto(-1));
  $('next-photo').addEventListener('click',()=>movePhoto(1));
  $('previous-post').addEventListener('click',()=>movePost(-1));
  $('next-post').addEventListener('click',()=>movePost(1));
  $('save-button').addEventListener('click',()=>{
    const id=getPost()?.id;if(!id)return;
    if(bookmarks.has(id)){bookmarks.delete(id);toast('Removed from saved places');}
    else{bookmarks.add(id);toast('Saved to your places');}
    safeWrite(savedKey,[...bookmarks]);renderGrid();
    $('save-button').classList.toggle('is-saved',bookmarks.has(id));
    $('save-button').setAttribute('aria-pressed',String(bookmarks.has(id)));
    $('save-button').setAttribute('aria-label',bookmarks.has(id)?'Remove saved restaurant':'Save restaurant');
  });
  $('share-button').addEventListener('click',async()=>{
    const post=getPost(); if(!post)return;
    const url=new URL(location.href);url.hash='post/'+encodeURIComponent(post.id);
    try{
      if(navigator.share)await navigator.share({title:`${post.name} · The London Table`,url:url.href});
      else{await navigator.clipboard.writeText(url.href);toast('Review link copied');}
    }catch(error){if(error.name!=='AbortError')toast('Could not share this link');}
  });
  $('comment-button').addEventListener('click',()=>{$('comments-section').scrollIntoView({behavior:'smooth',block:'nearest'});$('comment-input').focus({preventScroll:true});});
  $('like-button').addEventListener('click',async()=>{
    if(busyLike)return;
    if(!service){toast(serviceMode==='error'?'Firebase is not connected':'Reactions are connecting…');return;}
    busyLike=true;const id=getPost().id;const target=!currentLikes.includes(service.uid);
    $('like-button').disabled=true;
    try{await service.toggleLike(id,target);}catch(error){console.error(error);toast('Could not update like. Please try again.');}
    finally{busyLike=false;$('like-button').disabled=!service;}
  });
  $('comment-name').value=(() => {try{return localStorage.getItem('london-table-comment-name')||'';}catch{return '';}})();
  $('comment-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busyComment)return;
    if(!service){toast(serviceMode==='error'?'Firebase is not connected':'Comments are connecting…');return;}
    const author=$('comment-name').value.trim().slice(0,30),message=$('comment-input').value.trim().slice(0,500);
    if(author.length<2){toast('Please use a name with at least 2 characters');$('comment-name').focus();return;}
    if(!message){toast('Write a comment first');return;}
    busyComment=true;$('submit-comment').disabled=true;
    try{try{localStorage.setItem('london-table-comment-name',author);}catch{}
      await service.addComment(getPost().id,author,message);$('comment-input').value='';toast('Comment posted');
    }catch(error){console.error(error);toast('Could not post comment. Please try again.');}
    finally{busyComment=false;$('submit-comment').disabled=!service;}
  });
  document.addEventListener('keydown',event=>{
    if(!$('post-dialog').open)return;
    if(['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;
    if(event.key==='ArrowLeft'){event.preventDefault();movePhoto(-1);}
    if(event.key==='ArrowRight'){event.preventDefault();movePhoto(1);}
  });
  let touchStart=null;
  $('post-media').addEventListener('touchstart',event=>{if(event.touches.length===1)touchStart={x:event.touches[0].clientX,y:event.touches[0].clientY};},{passive:true});
  $('post-media').addEventListener('touchend',event=>{
    if(!touchStart)return;
    const dx=event.changedTouches[0].clientX-touchStart.x,dy=event.changedTouches[0].clientY-touchStart.y;touchStart=null;
    if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.3)movePhoto(dx<0?1:-1);
  },{passive:true});
  for(const tab of document.querySelectorAll('[data-tab]'))tab.addEventListener('click',()=>setTab(tab.dataset.tab));
  for(const nav of document.querySelectorAll('[data-nav]'))nav.addEventListener('click',()=>{
    if(nav.dataset.nav==='saved')setTab('saved');
    else{activeTab='posts';activeFilter='all';renderAll();window.scrollTo({top:0,behavior:'smooth'});}
  });
  window.addEventListener('hashchange',()=>{
    const match=location.hash.match(/^#post\/(.+)$/);
    if(match){const idx=postList.findIndex(p=>p.id===decodeURIComponent(match[1]));if(idx>=0&&(openIndex!==idx||!$('post-dialog').open))openPost(idx,false);}
    else if($('post-dialog').open)closePost();
  });
  // When a visitor returns, refresh totals from Firebase (subject to a short throttle).
  window.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - lastRefreshAt > 15000) refreshLikeTotals();
  });
  // Map markers open the same full-screen review dialog used by the post grid.
  document.addEventListener('london-table:open-post', (event) => {
    const postId = event.detail?.postId;
    const index = postList.findIndex(post => post.id === postId);
    if (index >= 0) openPost(index);
  });

  renderProfileAvatars();renderAll();
  if(postList.length)connectFirebase();
  const directLink=location.hash.match(/^#post\/(.+)$/);
  if(directLink){const idx=postList.findIndex(p=>p.id===decodeURIComponent(directLink[1]));if(idx>=0)openPost(idx,false);}
})();
