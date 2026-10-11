//go:build linux

// Package main starts the fixture.
package main

import "fmt"

// Run prints the greeting.
func Run() {
	fmt.Println("https://example.com") // the greeting
}

// helper is not exported, and says nothing the name does not.
func helper() {}

// invariant: the greeting is printed once.
func once() {}

//nolint:errcheck
func ignored() {}
