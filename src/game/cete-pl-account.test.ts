import { test } from 'node:test';
import assert from 'node:assert/strict';
import { polishAccountError, polishAccountText } from './cete-pl-account';
test('account validation and mapped authentication errors have Polish presentation', () => {
 assert.equal(polishAccountText('Kullanıcı adı en az 3 karakter olmalı.'), 'Nazwa użytkownika musi mieć co najmniej 3 znaki.');
 assert.equal(polishAccountError('Kullanıcı adı / e-posta veya şifre yanlış.'), 'Nazwa użytkownika, e-mail lub hasło są nieprawidłowe.');
 assert.equal(polishAccountError('unexpected server error'), 'Nie udało się wykonać operacji. Spróbuj ponownie.');
});
