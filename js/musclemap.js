// ALVéON PRIVÉ — the physique map. A vector Spartan drawn in code whose muscles light up with your level.
// Front and back, traced into tonal layers. Region polygons are in photo pixels; levels are drawn as
// blurred golden light over each region (unlit muscles stay in shadow).
import { MUSCLES } from './data.js';
import { FIG, FIG_OP } from './figure.js';

// The figure is vector art in a shared hidden sprite (injected once), referenced with <use>.
function sprite() {
  if (document.getElementById('figsprite')) return;
  const part = k => `<path id="figs-${k}" d="${FIG[k].sil}"/><g id="figb-${k}" fill-rule="evenodd">${FIG[k].bands.map((d, i) => `<path d="${d}" fill-opacity="${FIG_OP[i]}"/>`).join('')}</g>`;
  document.body.insertAdjacentHTML('afterbegin', `<svg id="figsprite" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden"><defs>${part('front')}${part('back')}</defs></svg>`);
}
const SIZE = { front: [941, 1672], back: [941, 1671] };
const VIEW = { front: '110 10 720 1660', back: '110 10 720 1660', mini: '190 380 580 580' };

const FRONT = [
  ['traps', 'M528 359 L524 397 L526 403 L621 432 L644 401 L637 394 L624 396 L611 389 L597 388 L551 356Z M480 359 L431 350 L352 385 L356 417 L441 418 L482 403 L484 397Z'],
  ['chest', 'M502 404 L441 418 L348 426 L345 456 L362 495 L409 515 L470 520 L503 501Z M508 403 L508 505 L549 520 L605 505 L625 480 L622 432 L580 419Z'],
  ['shoulders', 'M649 399 L628 421 L624 430 L620 472 L629 517 L637 521 L688 525 L693 518 L697 496 L698 457 L679 420 L662 404Z M333 378 L282 390 L273 395 L244 420 L230 442 L230 466 L235 483 L233 491 L263 525 L324 525 L346 490 L350 419Z'],
  ['abs', 'M440 513 L436 604 L448 699 L578 699 L585 616 L578 513Z'],
  ['obliques', 'M588 626 L580 695 L582 700 L607 695 L604 678 L592 653 L591 628Z M583 512 L588 606 L592 606 L603 584 L612 581 L626 606 L637 615 L647 631 L652 631 L655 597 L640 501Z M354 498 L352 587 L366 600 L385 611 L400 650 L392 691 L444 700 L446 697 L434 608 L438 513Z'],
  ['biceps', 'M630 526 L630 610 L662 645 L670 667 L667 684 L735 684 L739 640 L722 620 L714 594 L715 559 L701 527 L695 521Z M219 520 L214 527 L211 544 L220 573 L212 617 L206 626 L215 684 L284 685 L291 674 L287 651 L291 626 L312 604 L326 581 L335 526Z'],
  ['forearms', 'M690 691 L690 756 L699 765 L701 777 L716 790 L737 820 L748 846 L750 869 L807 869 L803 860 L799 821 L796 818 L794 760 L785 715 L775 710 L767 690Z M184 690 L171 709 L168 760 L174 811 L174 843 L170 869 L245 870 L247 867 L232 857 L235 848 L231 840 L236 812 L250 779 L269 753 L270 742 L285 719 L290 691Z'],
  ['quads', 'M600 860 L597 872 L593 984 L600 985 L602 990 L597 1012 L599 1026 L591 1031 L589 1152 L609 1183 L610 1214 L688 1215 L691 1211 L696 1172 L692 1166 L691 1142 L683 1112 L685 1092 L696 1063 L701 1035 L695 976 L658 874 L660 869 L666 868 L665 862Z M415 861 L421 880 L435 890 L443 910 L449 910 L448 861Z M330 860 L321 873 L329 881 L303 946 L294 989 L295 1026 L310 1071 L309 1095 L302 1117 L299 1143 L294 1147 L299 1209 L302 1215 L376 1215 L378 1172 L404 1135 L427 1075 L432 1053 L446 1032 L450 1003 L449 947 L444 940 L440 946 L434 946 L431 928 L422 922 L425 915 L423 902 L418 892 L401 874 L411 861Z'],
  ['calves', 'M613 1205 L606 1241 L606 1267 L603 1270 L608 1289 L607 1313 L619 1346 L649 1393 L669 1451 L676 1489 L745 1490 L743 1455 L739 1444 L737 1386 L740 1380 L738 1368 L741 1365 L739 1355 L745 1313 L739 1259 L725 1237 L712 1205Z M375 1205 L261 1206 L254 1233 L240 1255 L241 1268 L237 1297 L234 1300 L244 1348 L243 1358 L247 1365 L246 1390 L250 1396 L251 1452 L245 1486 L247 1490 L311 1489 L318 1437 L336 1392 L338 1376 L347 1367 L347 1362 L376 1308 L375 1297 L382 1268 L380 1220Z'],
];
const BACK = [
  ['traps', 'M501 340 L439 360 L360 395 L346 422 L346 426 L429 469 L500 559 L571 469 L630 430 L629 394 L561 360Z'],
  ['shoulders', 'M642 385 L626 429 L628 480 L661 525 L702 516 L706 509 L703 493 L709 470 L706 440 L698 424 L676 398Z M350 386 L286 395 L243 433 L237 453 L250 519 L320 530 L360 500 L372 439Z'],
  ['lats', 'M540 505 L538 607 L545 699 L574 700 L576 694 L567 673 L572 625 L595 603 L613 569 L617 567 L622 569 L630 584 L629 592 L637 611 L646 624 L650 624 L650 560 L611 516Z M443 505 L352 510 L349 514 L345 550 L350 598 L364 615 L383 629 L381 640 L387 679 L401 700 L468 699 L468 559Z'],
  ['lowerback', 'M468 601 L445 649 L450 711 L555 711 L560 650 L536 602Z'],
  ['triceps', 'M713 520 L640 526 L634 605 L665 646 L670 690 L738 689 L743 633 L731 618 L720 574 L724 539Z M343 520 L227 522 L223 533 L223 551 L228 567 L224 594 L218 615 L206 630 L215 689 L286 689 L286 647 L291 636 L316 606 L328 571 L340 570 L345 524Z'],
  ['forearms', 'M690 691 L692 766 L721 800 L739 831 L747 854 L746 879 L805 879 L795 823 L792 744 L783 704 L771 690Z M285 690 L180 690 L171 698 L163 739 L163 820 L155 879 L216 878 L214 859 L222 828 L242 793 L265 765 L266 754 L283 728 L287 713Z'],
  ['glutes', 'M362 898 L370 903 L506 945 L649 900 L630 819 L619 800 L500 790 L385 801Z'],
  ['hamstrings', 'M574 950 L570 988 L572 1112 L582 1168 L604 1198 L608 1210 L699 1210 L701 1207 L694 1197 L689 1168 L677 1143 L677 1117 L692 1061 L693 1026 L687 993 L672 951Z M298 950 L298 969 L290 996 L290 1069 L305 1118 L306 1147 L330 1214 L375 1208 L406 1158 L423 1106 L421 1094 L430 1091 L435 1107 L442 1093 L443 1080 L437 1079 L435 1074 L449 1039 L452 1014 L450 951Z'],
  ['calves', 'M606 1206 L610 1226 L603 1255 L602 1301 L607 1308 L620 1353 L626 1357 L650 1391 L678 1459 L686 1489 L752 1489 L744 1434 L744 1309 L741 1279 L733 1270 L723 1240 L698 1205Z M375 1205 L283 1206 L264 1233 L251 1267 L245 1271 L240 1311 L245 1401 L241 1490 L305 1489 L311 1460 L334 1396 L366 1348 L377 1307 L382 1299 L379 1292 L381 1261 L373 1226 L377 1211Z'],
];

export function renderBody(view, stats, { sel = null, size = 'full' } = {}) {
  sprite();
  const mini = size === 'mini';
  const key = view === 'back' ? 'back' : 'front';
  const list = key === 'back' ? BACK : FRONT;
  const [w, h] = SIZE[key];
  const vb = mini ? VIEW.mini : VIEW[key];
  const now = Date.now();
  const lit = [], hit = [];
  list.forEach(([m, d], i) => {
    const st = stats[m] || { level: 0 };
    const hot = st.last && now - new Date(st.last).getTime() < 48 * 3600 * 1000;
    lit.push(`<path class="reg l${st.level}${hot ? ' hot' : ''}" style="--i:${i}" d="${d}"/>`);
    hit.push(`<path class="hit${sel === m ? ' sel' : ''}" data-m="${m}" d="${d}" tabindex="0" role="button" aria-pressed="${sel === m}" aria-label="${MUSCLES[m]}, level ${st.level}"><title>${MUSCLES[m]} · level ${st.level}</title></path>`);
  });
  const blur = key === 'back' ? 9 : 9;
  const vh = +vb.split(' ')[3];
  return `<svg class="pmap ${size} ${key}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" role="${mini ? 'img' : 'group'}" aria-label="Muscle level map, ${key}">
<defs><filter id="soft${mini ? 'm' : ''}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${blur}"/></filter>
<linearGradient id="sweepG" x1="0" x2="1"><stop offset="0" stop-color="#ecdcb8" stop-opacity="0"/><stop offset=".5" stop-color="#f6ebd0" stop-opacity=".9"/><stop offset="1" stop-color="#ecdcb8" stop-opacity="0"/></linearGradient></defs>
<mask id="lm${mini ? 'm' : ''}" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><g filter="url(#soft${mini ? 'm' : ''})">${lit.join('')}</g></mask>
<use class="sil" href="#figs-${key}"/>
<use class="ph" href="#figb-${key}"/>
<use class="glow" href="#figb-${key}" mask="url(#lm${mini ? 'm' : ''})"/>
<rect class="wash" x="0" y="0" width="${w}" height="${h}" mask="url(#lm${mini ? 'm' : ''})"/>
<use class="rim" href="#figs-${key}"/>
${mini ? '' : `<g class="hits">${hit.join('')}</g>
<rect class="sweep" x="${vb.split(' ')[0]}" y="${vb.split(' ')[1]}" width="${vb.split(' ')[2]}" height="3" fill="url(#sweepG)" style="--h:${vh}px"/>`}
</svg>`;
}
