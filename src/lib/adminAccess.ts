import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { OWNER_EMAIL } from '../constants';
export function useAdminAccess(user: User | null) {
  const [access,setAccess]=useState({uid:'',admin:false,owner:false,loading:false});
  useEffect(()=>{
    let active=true;
    if(!user){setAccess({uid:'',admin:false,owner:false,loading:false});return;}
    setAccess({uid:user.uid,admin:false,owner:false,loading:true});
    void (async()=>{
      try{
        const token=await user.getIdTokenResult();
        const owner=token.claims.email_verified===true && token.claims.email===OWNER_EMAIL;
        const assigned=owner||token.claims.admin===true ? true : (await getDoc(doc(db,'admins',user.uid))).exists();
        if(active)setAccess({uid:user.uid,admin:assigned,owner,loading:false});
      }catch{if(active)setAccess({uid:user.uid,admin:false,owner:false,loading:false});}
    })();
    return ()=>{active=false;};
  },[user?.uid]);
  return access.uid===(user?.uid||'') ? access : {uid:user?.uid||'',admin:false,owner:false,loading:!!user};
}
