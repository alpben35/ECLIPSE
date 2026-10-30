import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
export default function SearchMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const publicPage = ['/', '/subscription', '/privacy', '/privacy-policy'].includes(pathname);
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) { robots=document.createElement('meta'); robots.name='robots'; document.head.append(robots); }
    robots.content=publicPage ? 'index, follow' : 'noindex, nofollow';
    const canonical=document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if(canonical) canonical.href='https://eclipseapp.co.uk'+(publicPage ? pathname : '/');
  },[pathname]);
  return null;
}
