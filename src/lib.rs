#![allow(unexpected_cfgs)]

#[macro_use]
extern crate napi_derive;

use napi::{bindgen_prelude::*, JsObject};
use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::sync::Arc;
use std::{fs::File, path::Path};

#[napi(object)]
#[derive(Serialize)]
pub struct ParserOptions {
    pub delimiter: Option<u8>,
    pub quote: Option<u8>,
    pub escape: Option<u8>,
    pub has_headers: Option<bool>,
    pub chunk_size: Option<u32>,
    pub buffer_capacity: Option<u32>,
}

#[napi(object)]
#[derive(Serialize)]
pub struct ParseResult {
    pub records: Vec<Vec<String>>,
    pub is_complete: bool,
}

impl ParseResult {
    fn into_js_object(self, env: &Env) -> Result<JsObject> {
        let mut obj = env.create_object()?;
        let mut records = env.create_array_with_length(self.records.len())?;

        for (i, record) in self.records.into_iter().enumerate() {
            let mut js_record = env.create_array_with_length(record.len())?;
            for (j, field) in record.into_iter().enumerate() {
                let js_field = env.create_string(&field)?;
                js_record.set_element(j as u32, js_field)?;
            }
            records.set_element(i as u32, js_record)?;
        }

        obj.set_named_property("records", records)?;
        obj.set_named_property("is_complete", self.is_complete)?;

        Ok(obj)
    }
}

struct Parser {
    delimiter: u8,
    quote: u8,
    escape: u8,
    has_headers: bool,
    chunk_size: usize,
    buffer_capacity: usize,
}

impl Parser {
    fn new(options: &ParserOptions) -> Self {
        Self {
            delimiter: options.delimiter.unwrap_or(b','),
            quote: options.quote.unwrap_or(b'"'),
            escape: options.escape.unwrap_or(b'\\'),
            has_headers: options.has_headers.unwrap_or(true),
            chunk_size: options.chunk_size.unwrap_or(1024 * 1024) as usize,
            buffer_capacity: options.buffer_capacity.unwrap_or(8192) as usize,
        }
    }

    fn process_chunk(&self, chunk: &[u8], state: &mut ParserState) -> Result<Vec<Vec<String>>> {
        let mut records = Vec::with_capacity(1000);
        let mut field = Vec::with_capacity(256);

        let mut i = 0;
        while i < chunk.len() {
            let byte = chunk[i];

            if state.escaped {
                field.push(byte);
                state.escaped = false;
            } else {
                match byte {
                    b if b == self.escape => state.escaped = true,
                    b if b == self.quote => state.in_quotes = !state.in_quotes,
                    b if b == self.delimiter && !state.in_quotes => {
                        if !field.is_empty() {
                            let field_str = String::from_utf8(field.clone())
                                .map_err(|e| Error::from_reason(e.to_string()))?;
                            state.current_record.push(field_str);
                        } else {
                            state.current_record.push(String::new());
                        }
                        field.clear();
                    }
                    b'\n' | b'\r' if !state.in_quotes => {
                        if !field.is_empty() || !state.current_record.is_empty() {
                            let field_str = String::from_utf8(field.clone())
                                .map_err(|e| Error::from_reason(e.to_string()))?;
                            state.current_record.push(field_str);

                            if !Self::is_record_empty(&state.current_record) {
                                records.push(std::mem::take(&mut state.current_record));
                            } else {
                                state.current_record.clear();
                            }
                        }
                        field.clear();

                        if byte == b'\r' && i + 1 < chunk.len() && chunk[i + 1] == b'\n' {
                            i += 1;
                        }
                    }
                    _ => field.push(byte),
                }
            }
            i += 1;
        }

        if !field.is_empty() || !state.current_record.is_empty() {
            if !field.is_empty() {
                let field_str = String::from_utf8(field)
                    .map_err(|e| Error::from_reason(e.to_string()))?;
                state.current_record.push(field_str);
            }
            
            if !Self::is_record_empty(&state.current_record) {
                records.push(std::mem::take(&mut state.current_record));
            }
        }

        Ok(records)
    }

    fn is_record_empty(record: &[String]) -> bool {
        record.iter().all(|field| field.trim().is_empty())
    }

    fn parse_file_streaming<P: AsRef<Path>>(
        &self,
        path: P,
        callback: &JsFunction,
        env: &Env,
    ) -> Result<()> {
        let file = File::open(path)
            .map_err(|e| Error::from_reason(format!("Failed to open file: {}", e)))?;

        let mut reader = BufReader::with_capacity(self.buffer_capacity, file);
        let mut state = ParserState::default();
        let mut is_first_chunk = true;
        let mut buffer = Vec::with_capacity(self.chunk_size);

        while reader
            .read_until(b'\n', &mut buffer)
            .map_err(|e| Error::from_reason(e.to_string()))?
            > 0
        {
            let mut records = self.process_chunk(&buffer, &mut state)?;

            if is_first_chunk && self.has_headers && !records.is_empty() {
                let headers = records.remove(0);
                let result = ParseResult {
                    records: vec![headers],
                    is_complete: false,
                };
                let js_obj = result.into_js_object(env)?;
                callback.call(None, &[js_obj])?;
                is_first_chunk = false;
            }

            if !records.is_empty() {
                let result = ParseResult {
                    records,
                    is_complete: false,
                };
                let js_obj = result.into_js_object(env)?;
                callback.call(None, &[js_obj])?;
            }

            buffer.clear();
        }

        let final_result = ParseResult {
            records: vec![],
            is_complete: true,
        };
        let js_obj = final_result.into_js_object(env)?;
        callback.call(None, &[js_obj])?;

        Ok(())
    }
}

#[derive(Default)]
struct ParserState {
    current_record: Vec<String>,
    in_quotes: bool,
    escaped: bool,
}

#[napi]
pub struct CsvParser {
    inner: Arc<Parser>,
}

#[napi]
impl CsvParser {
    #[napi(constructor)]
    pub fn new(options: Option<ParserOptions>) -> Self {
        let options = options.unwrap_or(ParserOptions {
            delimiter: None,
            quote: None,
            escape: None,
            has_headers: None,
            chunk_size: None,
            buffer_capacity: None,
        });

        Self {
            inner: Arc::new(Parser::new(&options)),
        }
    }

    #[napi]
    pub fn parse_file_streaming(
        &self,
        path: String,
        callback: JsFunction,
        env: Env,
    ) -> Result<()> {
        self.inner.parse_file_streaming(path, &callback, &env)
    }

    #[napi]
    pub fn parse_file(&self, path: String) -> Result<Vec<Vec<String>>> {
        let file = File::open(&path)
            .map_err(|e| Error::from_reason(format!("Failed to open file: {}", e)))?;

        let mut reader = BufReader::with_capacity(self.inner.buffer_capacity, file);
        let mut state = ParserState::default();
        let mut buffer = Vec::with_capacity(self.inner.chunk_size);
        let mut all_records = Vec::new();
        let mut is_first_chunk = true;

        while reader
            .read_until(b'\n', &mut buffer)
            .map_err(|e| Error::from_reason(e.to_string()))?
            > 0
        {
            let mut records = self.inner.process_chunk(&buffer, &mut state)?;

            if is_first_chunk && self.inner.has_headers && !records.is_empty() {
                let headers = records.remove(0);
                all_records.push(headers);
                is_first_chunk = false;
            }

            all_records.extend(records);
            buffer.clear();
        }

        Ok(all_records)
    }
}