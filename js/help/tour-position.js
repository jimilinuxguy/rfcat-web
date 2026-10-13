export function placeHelpCard(targetRect,cardWidth,cardHeight,viewportWidth,viewportHeight){
 const margin=12,gap=14;
 const left=Math.max(margin,Math.min(viewportWidth-cardWidth-margin,targetRect.right+gap+cardWidth<=viewportWidth-margin?targetRect.right+gap:targetRect.left-cardWidth-gap>=margin?targetRect.left-cardWidth-gap:targetRect.left));
 const top=Math.max(margin,Math.min(viewportHeight-cardHeight-margin,targetRect.top+cardHeight<=viewportHeight-margin?targetRect.top:targetRect.bottom-cardHeight));
 return {left,top};
}
