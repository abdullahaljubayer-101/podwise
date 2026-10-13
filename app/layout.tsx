import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = {title:'Podwise — Your podcast, understood',description:'Turn long listens into lasting knowledge. Podcast companion frontend preview.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
