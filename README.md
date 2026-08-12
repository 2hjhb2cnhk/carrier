# Carrier GreenON

Carrier GreenON은 캐리어 에어컨 사용자를 위한 ESG 친환경 냉방 미션 + GREEN POINT 리워드 웹앱입니다. 실제 에어컨 API 대신 가상 IoT 상태를 사용하며, 사용자 데이터는 Supabase Auth와 PostgreSQL RLS로 분리합니다.

배포 URL: https://carrier-greenon-kk1k.onrender.com

## 주요 사용자 흐름

회원가입/로그인 → 날씨와 가상 에어컨 확인 → GREEN MISSION 참여 → 30분 단위 시뮬레이션 → 미션 성공 및 포인트 적립 → GREEN WALLET 확인 → REWARD SHOP 구매 → GREEN REPORT 확인

## 기술 구성

- 모바일 우선 HTML, CSS, 바닐라 JavaScript
- Supabase Auth, PostgreSQL, RLS
- `supabase-js` 2.111.0 고정 CDN 버전
- Render Static Site 배포
- 샘플 날씨 데이터와 선택형 서버 프록시 구조

## 로컬 실행

1. `.env.example`을 `.env`로 복사합니다.
2. `SUPABASE_URL`과 브라우저용 `SUPABASE_PUBLISHABLE_KEY`를 입력합니다.
3. Node.js 20 이상에서 빌드합니다.

```bash
npm run build
```

4. 정적 파일 서버로 `dist` 폴더를 엽니다. 단순히 `index.html`을 직접 열어 UI를 확인할 수도 있지만, Supabase 이메일 리디렉션은 HTTP 주소에서 테스트해야 합니다.

## Supabase 설정

초기 데이터베이스 정의는 `supabase/schema.sql`에 있습니다. 현재 스키마에는 다음 데이터가 포함됩니다.

- `profiles`: 사용자 프로필, GREEN POINT, GREEN LEVEL
- `missions`, `user_missions`: 미션과 사용자 참여 기록
- `point_transactions`: 포인트 적립·사용 원장
- `rewards`, `reward_orders`: 리워드 상품과 구매내역
- `aircon_status`: 사용자별 가상 에어컨 상태

모든 public 테이블에는 RLS가 활성화되어 있습니다. 사용자 소유 데이터 정책은 `(select auth.uid()) = user_id` 또는 프로필 기본키를 사용합니다. 포인트 적립과 차감은 브라우저가 직접 수정하지 않고 `advance_green_mission`, `purchase_reward` RPC에서 원자적으로 처리합니다.

Supabase Auth 설정에서 Render 배포 주소를 Site URL과 Redirect URLs에 추가해야 이메일 확인 뒤 앱으로 돌아올 수 있습니다.

## 환경변수 보안

브라우저에는 publishable key만 전달합니다. 다음 값은 절대로 프런트엔드, Git 저장소, Render 정적 환경변수에 넣지 않습니다.

- `service_role` 키
- `sb_secret_...` 키
- 데이터베이스 비밀번호 또는 연결 문자열

## 자동 검사

Windows PowerShell 환경에서는 단계별 검사를 다음처럼 실행합니다.

```powershell
Get-ChildItem .\tests -Filter 'phase*.tests.ps1' |
  Sort-Object Name |
  ForEach-Object { powershell -NoProfile -ExecutionPolicy Bypass -File $_.FullName }
```

## Render 배포

1. 프로젝트를 Git 저장소에 올립니다.
2. Render Dashboard에서 Blueprint를 생성하고 루트의 `render.yaml`을 선택합니다.
3. `SUPABASE_URL`과 `SUPABASE_PUBLISHABLE_KEY`를 등록합니다.
4. 필요하면 `WEATHER_API_URL`에 비밀키 없는 서버 프록시 주소를 등록합니다.
5. 배포 후 Render URL을 Supabase Auth의 Site URL 및 Redirect URLs에 추가합니다.
6. 회원가입부터 리워드 구매까지 전체 사용자 흐름을 점검합니다.

Render는 `npm run build`를 실행해 공개 파일만 `dist`로 복사하며, 환경변수에서 브라우저용 `supabase-config.js`를 생성합니다. `supabase/schema.sql`, 테스트, 문서, 로컬 환경파일은 배포 결과물에 포함되지 않습니다.
