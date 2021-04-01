# Oekaki(仮称)

[Github Pages](https://ixactly.github.io/oekaki/)


## 使い方
* chromeで直接index.htmlを開くのだと動作しないため、vscodeの[liveserver](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)という拡張機能を使うなりしてローカルにサーバを建てる必要があります

## 概観
* cardinal-spline-js
  * 点を補完するライブラリ
* scripts_backup/
  * cdnが本番で落ちたとき用にライブラリを一応ダウンロードしてある
* index.html
* style.css
* script.js
  * メインスレッドで実行されるjsファイル
* render.js
  * webworker用のjsファイル
  * opencvやcardinal-spline-jsが実行される
  * opencv4.5.1だと動かなかったためバージョンが下げられている
